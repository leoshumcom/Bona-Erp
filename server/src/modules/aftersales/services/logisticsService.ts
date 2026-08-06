import { Prisma } from '@prisma/client';
import { prisma } from '../../../common/prisma';

// ============================================================
// 工具函数
// ============================================================

function paginate(page: number, pageSize: number) {
  return { skip: (page - 1) * pageSize, take: pageSize };
}

// ============================================================
// 物流 CRUD
// ============================================================

export interface CreateLogisticsParams {
  orderId: string;
  trackingNumber?: string;
  carrier?: string;
  channel?: string;
  stage?: string;
  firstMileFee?: number;
  internationalFee?: number;
  lastMileFee?: number;
  estimatedDelivery?: string;
  exceptionNote?: string;
}

/** 创建物流记录 */
export async function createLogistics(_userId: string, params: CreateLogisticsParams) {
  // 校验订单是否存在
  const order = await prisma.order.findUnique({ where: { id: params.orderId } });
  if (!order) {
    throw new Error('关联的订单不存在');
  }

  // 计算总费用
  const firstMileFee = params.firstMileFee != null ? new Prisma.Decimal(params.firstMileFee) : new Prisma.Decimal(0);
  const internationalFee = params.internationalFee != null ? new Prisma.Decimal(params.internationalFee) : new Prisma.Decimal(0);
  const lastMileFee = params.lastMileFee != null ? new Prisma.Decimal(params.lastMileFee) : new Prisma.Decimal(0);
  const totalFee = Prisma.Decimal.add(firstMileFee, Prisma.Decimal.add(internationalFee, lastMileFee));

  return prisma.logistics.create({
    data: {
      orderId: params.orderId,
      trackingNumber: params.trackingNumber,
      carrier: params.carrier,
      channel: params.channel,
      stage: (params.stage || 'FIRST_MILE') as any,
      status: 'PENDING',
      firstMileFee,
      internationalFee,
      lastMileFee,
      totalFee,
      estimatedDelivery: params.estimatedDelivery ? new Date(params.estimatedDelivery) : null,
      exceptionNote: params.exceptionNote,
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

export interface LogisticsFilters {
  status?: string;
  carrier?: string;
  stage?: string;
  orderId?: string;
  startDate?: string;
  endDate?: string;
  page: number;
  pageSize: number;
}

/** 物流列表（分页） */
export async function getLogisticsList(filters: LogisticsFilters) {
  const where: Prisma.LogisticsWhereInput = {};

  if (filters.status) where.status = filters.status as any;
  if (filters.carrier) where.carrier = { contains: filters.carrier };
  if (filters.stage) where.stage = filters.stage as any;
  if (filters.orderId) where.orderId = filters.orderId;
  if (filters.startDate || filters.endDate) {
    where.createdAt = {};
    if (filters.startDate) (where.createdAt as any).gte = new Date(filters.startDate);
    if (filters.endDate) (where.createdAt as any).lte = new Date(filters.endDate);
  }

  const [data, total] = await Promise.all([
    prisma.logistics.findMany({
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
    prisma.logistics.count({ where }),
  ]);

  return { data, total, page: filters.page, pageSize: filters.pageSize };
}

/** 物流详情 */
export async function getLogisticsDetail(id: string) {
  const record = await prisma.logistics.findUnique({
    where: { id },
    include: {
      order: {
        include: {
          store: { include: { platform: true } },
          items: { include: { product: true } },
          refunds: true,
        },
      },
    },
  });

  if (!record) {
    throw new Error('物流记录不存在');
  }

  return record;
}

/** 更新物流状态 */
export async function updateLogisticsStatus(id: string, status: string, actualDelivery?: string) {
  const existing = await prisma.logistics.findUnique({ where: { id } });
  if (!existing) {
    throw new Error('物流记录不存在');
  }

  const currentStatus = existing.status;
  const validTransitions: Record<string, string[]> = {
    PENDING: ['IN_TRANSIT', 'EXCEPTION'],
    IN_TRANSIT: ['DELIVERED', 'EXCEPTION', 'RETURNED'],
    DELIVERED: [],
    EXCEPTION: ['IN_TRANSIT', 'RETURNED'],
    RETURNED: [],
  };

  if (!validTransitions[currentStatus]?.includes(status)) {
    throw new Error(`不允许从「${currentStatus}」变更为「${status}」`);
  }

  const updateData: Prisma.LogisticsUpdateInput = {
    status: status as any,
  };

  if (status === 'IN_TRANSIT' && !existing.shippedAt) {
    updateData.shippedAt = new Date();
  }
  if (status === 'DELIVERED') {
    updateData.deliveredAt = actualDelivery ? new Date(actualDelivery) : new Date();
    updateData.actualDelivery = actualDelivery ? new Date(actualDelivery) : new Date();
  }

  return prisma.logistics.update({
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

/** 根据运单号追踪物流 */
export async function trackLogistics(trackingNumber: string) {
  const record = await prisma.logistics.findFirst({
    where: { trackingNumber },
    include: {
      order: {
        include: {
          store: { include: { platform: true } },
          items: { include: { product: true } },
          refunds: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  if (!record) {
    throw new Error('未找到该运单号的物流记录');
  }

  return record;
}

export interface ShippingCostSummaryResult {
  stage: string;
  carrier: string;
  totalFirstMile: Prisma.Decimal;
  totalInternational: Prisma.Decimal;
  totalLastMile: Prisma.Decimal;
  totalFeeSum: Prisma.Decimal;
  count: number;
}

/** 物流费用汇总（按阶段和承运商分组） */
export async function getShippingCostSummary(startDate?: string, endDate?: string) {
  const where: Prisma.LogisticsWhereInput = {};

  if (startDate || endDate) {
    where.shippedAt = {};
    if (startDate) (where.shippedAt as any).gte = new Date(startDate);
    if (endDate) (where.shippedAt as any).lte = new Date(endDate);
  }

  const records = await prisma.logistics.findMany({
    where,
    select: {
      stage: true,
      carrier: true,
      firstMileFee: true,
      internationalFee: true,
      lastMileFee: true,
      totalFee: true,
    },
  });

  // 内存分组汇总
  const groups = new Map<string, {
    stage: string;
    carrier: string;
    totalFirstMile: Prisma.Decimal;
    totalInternational: Prisma.Decimal;
    totalLastMile: Prisma.Decimal;
    totalFeeSum: Prisma.Decimal;
    count: number;
  }>();

  for (const r of records) {
    const key = `${r.stage}::${r.carrier ?? '未知'}`;
    const existing = groups.get(key);
    if (existing) {
      existing.totalFirstMile = Prisma.Decimal.add(existing.totalFirstMile, r.firstMileFee);
      existing.totalInternational = Prisma.Decimal.add(existing.totalInternational, r.internationalFee);
      existing.totalLastMile = Prisma.Decimal.add(existing.totalLastMile, r.lastMileFee);
      existing.totalFeeSum = Prisma.Decimal.add(existing.totalFeeSum, r.totalFee);
      existing.count += 1;
    } else {
      groups.set(key, {
        stage: r.stage,
        carrier: r.carrier ?? '未知',
        totalFirstMile: r.firstMileFee,
        totalInternational: r.internationalFee,
        totalLastMile: r.lastMileFee,
        totalFeeSum: r.totalFee,
        count: 1,
      });
    }
  }

  const summary = Array.from(groups.values()).map((g) => ({
    ...g,
    totalFirstMile: g.totalFirstMile.toString(),
    totalInternational: g.totalInternational.toString(),
    totalLastMile: g.totalLastMile.toString(),
    totalFeeSum: g.totalFeeSum.toString(),
  }));

  return {
    summary,
    grandTotal: summary.length > 0
      ? summary.reduce((acc, g) => acc + parseFloat(g.totalFeeSum), 0).toFixed(4)
      : '0.0000',
    totalRecords: records.length,
  };
}
