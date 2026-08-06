import { Prisma } from '@prisma/client';
import { prisma } from '../../../common/prisma';

// ============================================================
// 工具函数
// ============================================================

/** 将页面查询参数转换为 Prisma skip / take */
function paginate(page: number, pageSize: number) {
  return { skip: (page - 1) * pageSize, take: pageSize };
}

// ============================================================
// 售后工单 CRUD
// ============================================================

export interface CreateAfterSalesParams {
  orderId: string;
  type: string;
  reason: string;
  refundAmount?: number;
  logisticsFee?: number;
  compensation?: number;
  lossAmount?: number;
  resolution?: string;
}

/** 创建售后工单 */
export async function createAfterSales(_userId: string, params: CreateAfterSalesParams) {
  // 校验订单是否存在
  const order = await prisma.order.findUnique({ where: { id: params.orderId } });
  if (!order) {
    throw new Error('关联的订单不存在');
  }

  return prisma.afterSales.create({
    data: {
      orderId: params.orderId,
      type: params.type as any,
      reason: params.reason,
      refundAmount: params.refundAmount != null ? params.refundAmount : null,
      logisticsFee: params.logisticsFee != null ? params.logisticsFee : null,
      compensation: params.compensation != null ? params.compensation : null,
      lossAmount: params.lossAmount != null ? params.lossAmount : null,
      resolution: params.resolution,
      status: 'PENDING',
    },
    include: {
      order: {
        include: {
          store: true,
          items: { include: { product: true } },
        },
      },
    },
  });
}

export interface AfterSalesFilters {
  status?: string;
  type?: string;
  orderId?: string;
  startDate?: string;
  endDate?: string;
  page: number;
  pageSize: number;
}

/** 售后工单列表（分页） */
export async function getAfterSalesList(filters: AfterSalesFilters) {
  const where: Prisma.AfterSalesWhereInput = {};

  if (filters.status) where.status = filters.status as any;
  if (filters.type) where.type = filters.type as any;
  if (filters.orderId) where.orderId = filters.orderId;
  if (filters.startDate || filters.endDate) {
    where.createdAt = {};
    if (filters.startDate) (where.createdAt as any).gte = new Date(filters.startDate);
    if (filters.endDate) (where.createdAt as any).lte = new Date(filters.endDate);
  }

  const [data, total] = await Promise.all([
    prisma.afterSales.findMany({
      where,
      ...paginate(filters.page, filters.pageSize),
      orderBy: { createdAt: 'desc' },
      include: {
        order: {
          include: {
            store: true,
            items: { include: { product: true } },
          },
        },
      },
    }),
    prisma.afterSales.count({ where }),
  ]);

  return { data, total, page: filters.page, pageSize: filters.pageSize };
}

/** 售后工单详情 */
export async function getAfterSalesDetail(id: string) {
  const record = await prisma.afterSales.findUnique({
    where: { id },
    include: {
      order: {
        include: {
          store: { include: { platform: true } },
          items: { include: { product: true } },
          logistics: true,
        },
      },
    },
  });

  if (!record) {
    throw new Error('售后工单不存在');
  }

  return record;
}

/** 更新售后工单状态 */
export async function updateAfterSalesStatus(id: string, status: string, _userId: string) {
  const existing = await prisma.afterSales.findUnique({ where: { id } });
  if (!existing) {
    throw new Error('售后工单不存在');
  }

  // 状态流转校验
  const currentStatus = existing.status;
  const validTransitions: Record<string, string[]> = {
    PENDING: ['PROCESSING', 'REJECTED'],
    PROCESSING: ['COMPLETED'],
    COMPLETED: [],
    REJECTED: [],
  };

  if (!validTransitions[currentStatus]?.includes(status)) {
    throw new Error(`不允许从「${currentStatus}」变更为「${status}」`);
  }

  const updateData: Prisma.AfterSalesUpdateInput = {
    status: status as any,
  };

  if (status === 'COMPLETED') {
    updateData.resolvedAt = new Date();
  }

  return prisma.afterSales.update({
    where: { id },
    data: updateData,
    include: {
      order: {
        include: {
          store: true,
          items: { include: { product: true } },
        },
      },
    },
  });
}
