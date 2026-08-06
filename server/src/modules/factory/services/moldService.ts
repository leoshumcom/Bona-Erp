import { Prisma } from '@prisma/client';
import { prisma } from '../../../common/prisma';

// ============================================================
// 一、模具管理
// ============================================================

/**
 * 生成模具编号: MOLD-{date}-{seq}
 */
function generateMoldCode(): string {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const seq = Date.now().toString(36).toUpperCase().slice(-4);
  return `MOLD-${date}-${seq}`;
}

/**
 * 计算单件折旧金额 = 模具成本 / 使用寿命
 */
function calcDepreciationPerUnit(moldCost: number, lifespan: number): number {
  if (lifespan <= 0) return 0;
  return moldCost / lifespan;
}

/** 创建模具 */
export async function createMold(
  userId: string,
  params: {
    moldCode?: string;
    productId: string;
    moldCost: number;
    lifespan: number;
    startDate: string;
    scrapDate?: string;
    notes?: string;
  },
) {
  const moldCode = params.moldCode || generateMoldCode();
  const moldCost = params.moldCost;

  const mold = await prisma.mold.create({
    data: {
      moldCode,
      productId: params.productId,
      moldCost,
      lifespan: params.lifespan,
      startDate: new Date(params.startDate),
      scrapDate: params.scrapDate ? new Date(params.scrapDate) : null,
      notes: params.notes,
    },
    include: {
      product: { select: { id: true, sku: true, name: true } },
    },
  });

  return {
    ...mold,
    depreciationPerUnit: calcDepreciationPerUnit(moldCost, params.lifespan).toString(),
  };
}

/** 更新模具 */
export async function updateMold(
  id: string,
  params: {
    moldCode?: string;
    productId?: string;
    moldCost?: number;
    lifespan?: number;
    startDate?: string;
    scrapDate?: string;
    status?: string;
    notes?: string;
  },
) {
  const existing = await prisma.mold.findUniqueOrThrow({ where: { id } });

  const data: any = {};
  if (params.moldCode !== undefined) data.moldCode = params.moldCode;
  if (params.productId !== undefined) data.productId = params.productId;
  if (params.moldCost !== undefined) data.moldCost = params.moldCost;
  if (params.lifespan !== undefined) data.lifespan = params.lifespan;
  if (params.startDate !== undefined) data.startDate = new Date(params.startDate);
  if (params.scrapDate !== undefined) data.scrapDate = params.scrapDate ? new Date(params.scrapDate) : null;
  if (params.status !== undefined) data.status = params.status;
  if (params.notes !== undefined) data.notes = params.notes;

  const mold = await prisma.mold.update({
    where: { id },
    data,
    include: {
      product: { select: { id: true, sku: true, name: true } },
    },
  });

  return {
    ...mold,
    depreciationPerUnit: calcDepreciationPerUnit(mold.moldCost, mold.lifespan).toString(),
  };
}

/** 模具列表 */
export async function getMolds(filters: {
  status?: string;
  productId?: string;
  keyword?: string;
  page: number;
  pageSize: number;
}) {
  const where: any = {};

  if (filters.status) where.status = filters.status;
  if (filters.productId) where.productId = filters.productId;
  if (filters.keyword) {
    where.OR = [
      { moldCode: { contains: filters.keyword } },
      { product: { name: { contains: filters.keyword } } },
    ];
  }

  const [data, total] = await Promise.all([
    prisma.mold.findMany({
      where,
      include: {
        product: { select: { id: true, sku: true, name: true } },
        _count: {
          select: { expenses: true, depreciations: true },
        },
      },
      skip: (filters.page - 1) * filters.pageSize,
      take: filters.pageSize,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.mold.count({ where }),
  ]);

  const enriched = data.map((m) => ({
    ...m,
    depreciationPerUnit: calcDepreciationPerUnit(m.moldCost, m.lifespan).toString(),
  }));

  return { data: enriched, total, page: filters.page, pageSize: filters.pageSize };
}

/** 模具详情 */
export async function getMoldDetail(id: string) {
  const mold = await prisma.mold.findUniqueOrThrow({
    where: { id },
    include: {
      product: { select: { id: true, sku: true, name: true } },
      expenses: { orderBy: { expenseDate: 'desc' } },
      depreciations: { orderBy: { depreciationDate: 'desc' } },
    },
  });

  return {
    ...mold,
    depreciationPerUnit: calcDepreciationPerUnit(mold.moldCost, mold.lifespan).toString(),
  };
}

/** 记录模具费用 */
export async function recordMoldExpense(
  _userId: string,
  params: {
    moldId: string;
    type: string;
    amount: number;
    expenseDate: string;
    notes?: string;
  },
) {
  // 验证模具存在
  await prisma.mold.findUniqueOrThrow({ where: { id: params.moldId } });

  const expense = await prisma.moldExpense.create({
    data: {
      moldId: params.moldId,
      type: params.type,
      amount: params.amount,
      expenseDate: new Date(params.expenseDate),
      notes: params.notes,
    },
    include: {
      mold: { select: { id: true, moldCode: true } },
    },
  });

  return expense;
}

/** 获取模具折旧记录 */
export async function getMoldDepreciation(filters: {
  moldId?: string;
  startDate?: string;
  endDate?: string;
  page: number;
  pageSize: number;
}) {
  const where: any = {};

  if (filters.moldId) where.moldId = filters.moldId;
  if (filters.startDate || filters.endDate) {
    where.depreciationDate = {};
    if (filters.startDate) where.depreciationDate.gte = new Date(filters.startDate);
    if (filters.endDate) where.depreciationDate.lte = new Date(filters.endDate);
  }

  const [data, total] = await Promise.all([
    prisma.moldDepreciation.findMany({
      where,
      include: {
        mold: { select: { id: true, moldCode: true, productId: true } },
      },
      skip: (filters.page - 1) * filters.pageSize,
      take: filters.pageSize,
      orderBy: { depreciationDate: 'desc' },
    }),
    prisma.moldDepreciation.count({ where }),
  ]);

  // 汇总折旧总额
  const totalAmount = await prisma.moldDepreciation.aggregate({
    where,
    _sum: { amount: true },
  });

  return {
    data,
    total,
    totalDepreciationAmount: totalAmount._sum.amount?.toString() ?? '0',
    page: filters.page,
    pageSize: filters.pageSize,
  };
}

/** 获取模具费用汇总 */
export async function getMoldExpenseSummary(moldId: string) {
  const [mold, expensesTotal, depreciationTotal] = await Promise.all([
    prisma.mold.findUniqueOrThrow({
      where: { id: moldId },
      select: { id: true, moldCode: true, moldCost: true, lifespan: true, producedCount: true },
    }),
    prisma.moldExpense.aggregate({
      where: { moldId },
      _sum: { amount: true },
    }),
    prisma.moldDepreciation.aggregate({
      where: { moldId },
      _sum: { amount: true },
    }),
  ]);

  const expenseTotal = expensesTotal._sum.amount ?? 0;
  const depTotal = depreciationTotal._sum.amount ?? 0;
  const totalCost = mold.moldCost + expenseTotal;

  return {
    moldCode: mold.moldCode,
    originalCost: mold.moldCost.toString(),
    totalExpenses: expenseTotal.toString(),
    totalDepreciation: depTotal.toString(),
    totalCost: totalCost.toString(),
    producedCount: mold.producedCount,
    lifespan: mold.lifespan,
    depreciationPerUnit: calcDepreciationPerUnit(mold.moldCost, mold.lifespan).toString(),
  };
}
