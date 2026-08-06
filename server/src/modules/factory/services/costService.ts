import { Prisma } from '@prisma/client';
import { prisma } from '../../../common/prisma';

// ============================================================
// 工厂成本核算
// ============================================================

/**
 * 获取单个工单的成本汇总（按成本类型分组）
 */
export async function getProductionCostSummary(productionOrderId: string) {
  // 验证工单存在
  const order = await prisma.productionOrder.findUniqueOrThrow({
    where: { id: productionOrderId },
    select: { id: true, orderNumber: true, quantity: true, completedQuantity: true, productId: true },
  });

  // 按成本类型分组汇总
  const costItems = await prisma.productionCost.groupBy({
    by: ['costType'],
    where: { productionOrderId },
    _sum: { amount: true },
  });

  const totalCost = costItems.reduce(
    (sum, item) => Prisma.Decimal.add(sum, item._sum.amount ?? new Prisma.Decimal(0)),
    new Prisma.Decimal(0),
  );

  const breakdown = costItems.map((item) => ({
    costType: item.costType,
    amount: (item._sum.amount ?? new Prisma.Decimal(0)).toString(),
  }));

  return {
    orderId: order.id,
    orderNumber: order.orderNumber,
    productId: order.productId,
    plannedQuantity: order.quantity.toString(),
    completedQuantity: order.completedQuantity.toString(),
    totalCost: totalCost.toString(),
    unitCost: order.completedQuantity.gt(0)
      ? Prisma.Decimal.div(totalCost, order.completedQuantity).toString()
      : '0',
    breakdown,
  };
}

/**
 * 产品成本分解 - 指定产品的所有完工工单平均单位成本
 */
export async function getProductCostBreakdown(
  productId: string,
  startDate?: string,
  endDate?: string,
) {
  const dateFilter: any = {};
  if (startDate || endDate) {
    dateFilter.createdAt = {};
    if (startDate) dateFilter.createdAt.gte = new Date(startDate);
    if (endDate) dateFilter.createdAt.lte = new Date(endDate);
  }

  // 查找该产品的所有已完工工单
  const completedOrders = await prisma.productionOrder.findMany({
    where: {
      productId,
      status: { in: ['COMPLETED', 'CLOSED'] },
      ...dateFilter,
    },
    select: { id: true, orderNumber: true, completedQuantity: true },
  });

  if (completedOrders.length === 0) {
    return {
      productId,
      totalOrders: 0,
      totalQuantity: '0',
      totalCost: '0',
      averageUnitCost: '0',
      orders: [],
    };
  }

  // 汇总所有完工工单的成本
  const orderIds = completedOrders.map((o) => o.id);
  const costs = await prisma.productionCost.groupBy({
    by: ['productionOrderId', 'costType'],
    where: { productionOrderId: { in: orderIds } },
    _sum: { amount: true },
  });

  // 汇总每个工单的总成本
  const orderCostMap = new Map<string, Prisma.Decimal>();
  const typeAggregate: Record<string, Prisma.Decimal> = {};

  for (const c of costs) {
    const amount = c._sum.amount ?? new Prisma.Decimal(0);
    const existing = orderCostMap.get(c.productionOrderId) ?? new Prisma.Decimal(0);
    orderCostMap.set(c.productionOrderId, Prisma.Decimal.add(existing, amount));

    const typeExisting = typeAggregate[c.costType] ?? new Prisma.Decimal(0);
    typeAggregate[c.costType] = Prisma.Decimal.add(typeExisting, amount);
  }

  let totalCost = new Prisma.Decimal(0);
  let totalQuantity = new Prisma.Decimal(0);

  const orders = completedOrders.map((order) => {
    const orderCost = orderCostMap.get(order.id) ?? new Prisma.Decimal(0);
    totalCost = Prisma.Decimal.add(totalCost, orderCost);
    totalQuantity = Prisma.Decimal.add(totalQuantity, order.completedQuantity);

    return {
      orderId: order.id,
      orderNumber: order.orderNumber,
      completedQuantity: order.completedQuantity.toString(),
      totalCost: orderCost.toString(),
      unitCost: order.completedQuantity.gt(0)
        ? Prisma.Decimal.div(orderCost, order.completedQuantity).toString()
        : '0',
    };
  });

  return {
    productId,
    totalOrders: completedOrders.length,
    totalQuantity: totalQuantity.toString(),
    totalCost: totalCost.toString(),
    averageUnitCost: totalQuantity.gt(0)
      ? Prisma.Decimal.div(totalCost, totalQuantity).toString()
      : '0',
    costByType: Object.entries(typeAggregate).map(([type, amount]) => ({
      costType: type,
      amount: amount.toString(),
    })),
    orders,
  };
}

/**
 * 模具成本分摊 - 指定产品关联的所有模具费用 + 折旧
 */
export async function getMoldCostAllocation(productId: string) {
  const molds = await prisma.mold.findMany({
    where: { productId },
    select: { id: true, moldCode: true, moldCost: true, lifespan: true, producedCount: true },
  });

  if (molds.length === 0) {
    return {
      productId,
      moldCount: 0,
      totalMoldCost: '0',
      totalExpenses: '0',
      totalDepreciation: '0',
      totalAllocation: '0',
      molds: [],
    };
  }

  const moldIds = molds.map((m) => m.id);

  const [expensesAgg, depreciationAgg] = await Promise.all([
    prisma.moldExpense.aggregate({
      where: { moldId: { in: moldIds } },
      _sum: { amount: true },
    }),
    prisma.moldDepreciation.aggregate({
      where: { moldId: { in: moldIds } },
      _sum: { amount: true },
    }),
  ]);

  let totalMoldCost = new Prisma.Decimal(0);
  const moldDetails = molds.map((m) => {
    totalMoldCost = Prisma.Decimal.add(totalMoldCost, m.moldCost);
    const depreciationPerUnit = m.lifespan > 0
      ? Prisma.Decimal.div(m.moldCost, m.lifespan)
      : new Prisma.Decimal(0);
    return {
      moldId: m.id,
      moldCode: m.moldCode,
      moldCost: m.moldCost.toString(),
      lifespan: m.lifespan,
      producedCount: m.producedCount,
      depreciationPerUnit: depreciationPerUnit.toString(),
    };
  });

  const totalExpenses = expensesAgg._sum.amount ?? new Prisma.Decimal(0);
  const totalDepreciation = depreciationAgg._sum.amount ?? new Prisma.Decimal(0);
  const totalAllocation = Prisma.Decimal.add(
    Prisma.Decimal.add(totalMoldCost, totalExpenses),
    totalDepreciation,
  );

  return {
    productId,
    moldCount: molds.length,
    totalMoldCost: totalMoldCost.toString(),
    totalExpenses: totalExpenses.toString(),
    totalDepreciation: totalDepreciation.toString(),
    totalAllocation: totalAllocation.toString(),
    molds: moldDetails,
  };
}

/**
 * 工厂固定费用汇总 - 指定月份汇总
 */
export async function getFactoryOverhead(period: string) {
  const expenses = await prisma.factoryFixedExpense.findMany({
    where: { expenseMonth: period },
    orderBy: { expenseType: 'asc' },
  });

  const totalAmount = expenses.reduce(
    (sum, e) => Prisma.Decimal.add(sum, e.amount),
    new Prisma.Decimal(0),
  );

  const byType: Record<string, Prisma.Decimal> = {};
  for (const e of expenses) {
    const existing = byType[e.expenseType] ?? new Prisma.Decimal(0);
    byType[e.expenseType] = Prisma.Decimal.add(existing, e.amount);
  }

  return {
    period,
    totalAmount: totalAmount.toString(),
    expenseCount: expenses.length,
    byType: Object.entries(byType).map(([type, amount]) => ({
      expenseType: type,
      amount: amount.toString(),
    })),
    items: expenses,
  };
}

/**
 * 记录工厂固定费用
 */
export async function recordFactoryExpense(
  _userId: string,
  params: {
    expenseType: string;
    amount: number;
    expenseMonth: string;
    notes?: string;
  },
) {
  return prisma.factoryFixedExpense.create({
    data: {
      expenseType: params.expenseType,
      amount: new Prisma.Decimal(params.amount),
      expenseMonth: params.expenseMonth,
      notes: params.notes,
    },
  });
}

/**
 * 工厂固定费用列表
 */
export async function getFactoryExpenses(filters: {
  expenseMonth?: string;
  expenseType?: string;
  page: number;
  pageSize: number;
}) {
  const where: any = {};

  if (filters.expenseMonth) where.expenseMonth = filters.expenseMonth;
  if (filters.expenseType) where.expenseType = filters.expenseType;

  const [data, total] = await Promise.all([
    prisma.factoryFixedExpense.findMany({
      where,
      skip: (filters.page - 1) * filters.pageSize,
      take: filters.pageSize,
      orderBy: { expenseMonth: 'desc' },
    }),
    prisma.factoryFixedExpense.count({ where }),
  ]);

  return { data, total, page: filters.page, pageSize: filters.pageSize };
}
