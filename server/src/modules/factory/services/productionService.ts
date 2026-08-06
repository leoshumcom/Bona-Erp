import { Prisma } from '@prisma/client';
import { prisma } from '../../../common/prisma';

// ============================================================
// 生产工单管理
// ============================================================

/**
 * 生成工单编号: PO-{date}-{seq}
 */
async function generateOrderNumber(): Promise<string> {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const count = await prisma.productionOrder.count({
    where: {
      createdAt: { gte: todayStart },
    },
  });
  const seq = (count + 1).toString().padStart(4, '0');
  return `PO-${date}-${seq}`;
}

// ============================================================
// 状态转换验证
// ============================================================

/** 允许的状态转换映射 */
const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  DRAFT: ['RELEASED', 'CANCELLED'],
  RELEASED: ['IN_PROGRESS', 'CANCELLED'],
  IN_PROGRESS: ['COMPLETED', 'CANCELLED'],
  COMPLETED: ['CLOSED'],
  CANCELLED: [],
  CLOSED: [],
};

function validateStatusTransition(current: string, target: string): void {
  const allowed = ALLOWED_TRANSITIONS[current];
  if (!allowed || !allowed.includes(target)) {
    throw new StatusTransitionError(current, target);
  }
}

export class StatusTransitionError extends Error {
  constructor(
    public readonly current: string,
    public readonly target: string,
  ) {
    super(`状态转换不允许: ${current} → ${target}`);
    this.name = 'StatusTransitionError';
  }
}

// ============================================================
// CRUD
// ============================================================

/** 创建生产工单 */
export async function createProductionOrder(
  userId: string,
  params: {
    productId: string;
    bomId: string;
    quantity: number;
    unitOfMeasureId: string;
    plannedStartDate?: string;
    plannedEndDate?: string;
    notes?: string;
  },
) {
  // 1. 验证 BOM 存在且状态为 ACTIVE
  const bom = await prisma.billOfMaterials.findUniqueOrThrow({
    where: { id: params.bomId },
    include: {
      lines: {
        include: {
          material: true,
          unitOfMeasure: true,
        },
        orderBy: { lineNumber: 'asc' },
      },
    },
  });

  if (bom.status !== 'ACTIVE') {
    throw new Error(`BOM "${bom.bomNumber}" 未激活，无法创建生产工单`);
  }
  if (bom.productId !== params.productId) {
    throw new Error('BOM 与产品不匹配');
  }

  const orderNumber = await generateOrderNumber();
  const quantity = params.quantity;

  const order = await prisma.$transaction(async (tx) => {
    // 1. 创建工单头
    const header = await tx.productionOrder.create({
      data: {
        orderNumber,
        status: 'DRAFT',
        productId: params.productId,
        quantity,
        unitOfMeasureId: params.unitOfMeasureId,
        bomId: params.bomId,
        plannedStartDate: params.plannedStartDate ? new Date(params.plannedStartDate) : null,
        plannedEndDate: params.plannedEndDate ? new Date(params.plannedEndDate) : null,
        createdById: userId,
        notes: params.notes,
      },
    });

    // 2. 根据 BOM 行创建工单组件
    const components = await Promise.all(
      bom.lines.map((line) =>
        tx.productionOrderComponent.create({
          data: {
            productionOrderId: header.id,
            lineNumber: line.lineNumber,
            materialId: line.materialId,
            unitOfMeasureId: line.unitOfMeasureId,
            // 按 BOM 用量 * 工单数量 / BOM基础数量 计算计划用量
            plannedQuantity: (line.quantity * quantity) / bom.baseQuantity,
            notes: line.notes,
          },
        }),
      ),
    );

    return { ...header, components };
  });

  return order;
}

/** 下达工单 */
export async function releaseProductionOrder(id: string) {
  const order = await prisma.productionOrder.findUniqueOrThrow({ where: { id } });
  validateStatusTransition(order.status, 'RELEASED');

  return prisma.productionOrder.update({
    where: { id },
    data: {
      status: 'RELEASED',
      releasedAt: new Date(),
    },
  });
}

/** 开始生产 */
export async function startProduction(id: string) {
  const order = await prisma.productionOrder.findUniqueOrThrow({ where: { id } });
  validateStatusTransition(order.status, 'IN_PROGRESS');

  return prisma.productionOrder.update({
    where: { id },
    data: {
      status: 'IN_PROGRESS',
      startedAt: new Date(),
    },
  });
}

/** 完成生产 */
export async function completeProduction(id: string) {
  const order = await prisma.productionOrder.findUniqueOrThrow({ where: { id } });
  validateStatusTransition(order.status, 'COMPLETED');

  return prisma.productionOrder.update({
    where: { id },
    data: {
      status: 'COMPLETED',
      completedAt: new Date(),
      completedQuantity: order.quantity,
    },
  });
}

/** 关闭工单 */
export async function closeProductionOrder(id: string) {
  const order = await prisma.productionOrder.findUniqueOrThrow({ where: { id } });
  validateStatusTransition(order.status, 'CLOSED');

  return prisma.productionOrder.update({
    where: { id },
    data: {
      status: 'CLOSED',
      closedAt: new Date(),
    },
  });
}

/** 取消工单 */
export async function cancelProductionOrder(id: string) {
  const order = await prisma.productionOrder.findUniqueOrThrow({ where: { id } });
  validateStatusTransition(order.status, 'CANCELLED');

  return prisma.productionOrder.update({
    where: { id },
    data: { status: 'CANCELLED' },
  });
}

/** 更新工单状态（通用） */
export async function updateStatus(
  id: string,
  newStatus: string,
  _userId: string,
) {
  const order = await prisma.productionOrder.findUniqueOrThrow({ where: { id } });

  // 映射到实际枚举值
  const validStatuses = ['DRAFT', 'RELEASED', 'IN_PROGRESS', 'COMPLETED', 'CLOSED', 'CANCELLED'];
  if (!validStatuses.includes(newStatus)) {
    throw new Error(`无效的状态: ${newStatus}`);
  }

  validateStatusTransition(order.status, newStatus);

  const data: any = { status: newStatus };
  if (newStatus === 'RELEASED') data.releasedAt = new Date();
  if (newStatus === 'IN_PROGRESS') data.startedAt = new Date();
  if (newStatus === 'COMPLETED') {
    data.completedAt = new Date();
    data.completedQuantity = order.quantity;
  }
  if (newStatus === 'CLOSED') data.closedAt = new Date();

  return prisma.productionOrder.update({
    where: { id },
    data,
  });
}

/** 生产工单列表 */
export async function getProductionOrders(filters: {
  status?: string;
  productId?: string;
  keyword?: string;
  startDate?: string;
  endDate?: string;
  page: number;
  pageSize: number;
}) {
  const where: any = {};

  if (filters.status) where.status = filters.status;
  if (filters.productId) where.productId = filters.productId;
  if (filters.keyword) {
    where.OR = [
      { orderNumber: { contains: filters.keyword } },
      { product: { name: { contains: filters.keyword } } },
    ];
  }
  if (filters.startDate || filters.endDate) {
    where.createdAt = {};
    if (filters.startDate) where.createdAt.gte = new Date(filters.startDate);
    if (filters.endDate) where.createdAt.lte = new Date(filters.endDate);
  }

  const [data, total] = await Promise.all([
    prisma.productionOrder.findMany({
      where,
      include: {
        product: { select: { id: true, sku: true, name: true } },
        unitOfMeasure: { select: { id: true, code: true } },
        bom: { select: { id: true, bomNumber: true, version: true } },
        _count: {
          select: { components: true, operations: true, costs: true },
        },
      },
      skip: (filters.page - 1) * filters.pageSize,
      take: filters.pageSize,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.productionOrder.count({ where }),
  ]);

  return { data, total, page: filters.page, pageSize: filters.pageSize };
}

/** 生产工单详情 */
export async function getProductionOrderDetail(id: string) {
  const order = await prisma.productionOrder.findUniqueOrThrow({
    where: { id },
    include: {
      product: { select: { id: true, sku: true, name: true } },
      unitOfMeasure: { select: { id: true, code: true, description: true } },
      bom: {
        select: { id: true, bomNumber: true, version: true, baseQuantity: true },
      },
      components: {
        include: {
          material: { select: { id: true, sku: true, name: true } },
          unitOfMeasure: { select: { id: true, code: true } },
        },
        orderBy: { lineNumber: 'asc' },
      },
      operations: {
        include: {
          workCenter: { select: { id: true, code: true, name: true, costPerHour: true } },
        },
        orderBy: { sequence: 'asc' },
      },
      costs: { orderBy: { createdAt: 'desc' } },
    },
  });

  return order;
}

/** 记录生产成本 */
export async function recordProductionCost(
  _userId: string,
  params: {
    productionOrderId: string;
    costType: string;
    amount: number;
    notes?: string;
  },
) {
  // 验证工单存在
  await prisma.productionOrder.findUniqueOrThrow({
    where: { id: params.productionOrderId },
  });

  return prisma.productionCost.create({
    data: {
      productionOrderId: params.productionOrderId,
      costType: params.costType,
      amount: params.amount,
      notes: params.notes,
    },
  });
}
