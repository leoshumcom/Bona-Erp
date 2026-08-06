import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

// ============================================================
// 一、计算单笔订单利润
// ============================================================

export async function calculateOrderProfit(orderId: string, userId: string) {
  return prisma.$transaction(async (tx) => {
    // 0. 获取订单基本信息（含明细和店铺）
    const order = await tx.order.findUniqueOrThrow({
      where: { id: orderId },
      include: {
        items: { include: { product: true } },
        store: true,
        fees: true,
        logistics: true,
      },
    });

    const revenue = order.totalAmount; // 销售额

    // 1. 生产成本：按订单中每个产品行分别核算
    //    = SUM(ProductionOrder.ProductionCost where productionOrder.productId = 该产品) / completedQuantity * orderItem.quantity
    let totalProductCost = new Prisma.Decimal(0);

    for (const item of order.items) {
      const productCost = await getProductCostPerUnit(tx, item.productId);
      const itemCost = productCost.mul(item.quantity);
      totalProductCost = Prisma.Decimal.add(totalProductCost, itemCost);
    }

    // 2. 仓储分摊成本：当月仓储费用 / 当月总库存量 * 订单产品数量
    let warehouseCost = new Prisma.Decimal(0);
    try {
      warehouseCost = await getWarehouseCostAllocation(tx, order);
    } catch {
      // 无仓储费用数据时默认为0
    }

    // 3. 广告费分摊：订单所属店铺的广告花费 / 该店铺同期订单数
    let adCost = new Prisma.Decimal(0);
    try {
      adCost = await getAdCostAllocation(tx, order);
    } catch {
      // 无广告数据时默认为0
    }

    // 4. 平台费用：从 OrderFee 中汇总 platform_commission
    const platformFee = order.fees
      .filter((f) => f.feeType === 'platform_commission')
      .reduce((sum, f) => Prisma.Decimal.add(sum, f.amount), new Prisma.Decimal(0));

    // 5. 物流费用：从 Logistics 或 OrderFee 中汇总
    const logisticsFee = order.fees
      .filter((f) => f.feeType === 'logistics')
      .reduce((sum, f) => Prisma.Decimal.add(sum, f.amount), new Prisma.Decimal(0));

    const logisticsTotalFee = order.logistics
      ? Prisma.Decimal.add(order.logistics.totalFee, logisticsFee)
      : logisticsFee;

    // 6. 售后费用：合计该订单所有售后记录
    const afterSalesRecords = await tx.afterSales.findMany({
      where: { orderId },
    });

    let aftersalesFee = new Prisma.Decimal(0);
    for (const as of afterSalesRecords) {
      if (as.refundAmount) aftersalesFee = Prisma.Decimal.add(aftersalesFee, as.refundAmount);
      if (as.logisticsFee) aftersalesFee = Prisma.Decimal.add(aftersalesFee, as.logisticsFee);
      if (as.compensation) aftersalesFee = Prisma.Decimal.add(aftersalesFee, as.compensation);
      if (as.lossAmount) aftersalesFee = Prisma.Decimal.add(aftersalesFee, as.lossAmount);
    }

    // 7. 计算总成本和利润
    const totalCost = Prisma.Decimal.add(
      Prisma.Decimal.add(
        Prisma.Decimal.add(
          Prisma.Decimal.add(totalProductCost, warehouseCost),
          adCost,
        ),
        platformFee,
      ),
      Prisma.Decimal.add(logisticsTotalFee, aftersalesFee),
    );

    const netProfit = Prisma.Decimal.sub(revenue, totalCost);

    // 利润率（净利率）
    const profitMargin = revenue.gt(0)
      ? Prisma.Decimal.div(netProfit, revenue)
      : new Prisma.Decimal(0);

    // 8. 创建或更新 OrderProfit 记录
    const profitData = {
      salesAmount: revenue,
      refundAmount: aftersalesFee, // 售后费用归入退款
      productCost: totalProductCost,
      warehouseCost,
      platformFee,
      adFee: adCost,
      logisticsFee: logisticsTotalFee,
      aftersalesFee,
      taxFee: new Prisma.Decimal(0),
      grossProfit: Prisma.Decimal.sub(revenue, totalProductCost),
      netProfit,
      profitMargin,
      calculatedAt: new Date(),
    };

    const orderProfit = await tx.orderProfit.upsert({
      where: { orderId },
      create: {
        orderId,
        ...profitData,
      },
      update: {
        ...profitData,
      },
    });

    return {
      orderProfit,
      breakdown: {
        revenue: Number(revenue),
        productCost: Number(totalProductCost),
        warehouseCost: Number(warehouseCost),
        adCost: Number(adCost),
        platformFee: Number(platformFee),
        logisticsFee: Number(logisticsTotalFee),
        aftersalesFee: Number(aftersalesFee),
        totalCost: Number(totalCost),
        netProfit: Number(netProfit),
        profitMargin: Number(profitMargin),
      },
    };
  });
}

// ============================================================
// 辅助：产品单位生产成本
// ============================================================

async function getProductCostPerUnit(
  tx: Prisma.TransactionClient,
  productId: string,
): Promise<Prisma.Decimal> {
  // 查找该产品的已完成生产工单，取生产成本
  const productionOrders = await tx.productionOrder.findMany({
    where: {
      productId,
      status: { in: ['COMPLETED', 'CLOSED'] },
      completedQuantity: { gt: 0 },
    },
    include: {
      costs: true,
    },
  });

  if (productionOrders.length === 0) {
    // 回退到产品的标准成本或当前成本
    const product = await tx.product.findUniqueOrThrow({ where: { id: productId } });
    return product.currentCost ?? product.standardCost ?? new Prisma.Decimal(0);
  }

  // 加权平均计算单位生产成本
  let totalCost = new Prisma.Decimal(0);
  let totalQuantity = new Prisma.Decimal(0);

  for (const po of productionOrders) {
    const poCost = po.costs.reduce(
      (sum, c) => Prisma.Decimal.add(sum, c.amount),
      new Prisma.Decimal(0),
    );
    totalCost = Prisma.Decimal.add(totalCost, poCost);
    totalQuantity = Prisma.Decimal.add(totalQuantity, po.completedQuantity);
  }

  if (totalQuantity.eq(0)) {
    return new Prisma.Decimal(0);
  }

  return Prisma.Decimal.div(totalCost, totalQuantity);
}

// ============================================================
// 辅助：仓储费用分摊
// ============================================================

async function getWarehouseCostAllocation(
  tx: Prisma.TransactionClient,
  order: any,
): Promise<Prisma.Decimal> {
  const orderedMonth = order.orderedAt.toISOString().slice(0, 7); // YYYY-MM

  // 当月仓储费用
  const warehouseExpenses = await tx.warehouseExpense.aggregate({
    where: { expenseMonth: orderedMonth },
    _sum: { amount: true },
  });

  const totalWarehouseCost = warehouseExpenses._sum.amount ?? new Prisma.Decimal(0);

  if (totalWarehouseCost.eq(0)) {
    return new Prisma.Decimal(0);
  }

  // 当月总库存量（所有产品的库存余额合计）
  const inventorySum = await tx.inventoryBalance.aggregate({
    _sum: { quantityOnHand: true },
  });

  const totalInventory = inventorySum._sum.quantityOnHand ?? new Prisma.Decimal(1);

  if (totalInventory.eq(0)) {
    return new Prisma.Decimal(0);
  }

  // 该订单的产品总数量
  const orderTotalQty = order.items.reduce(
    (sum: number, item: any) => sum + item.quantity,
    0,
  );

  // 按库存比例分摊: (订单数量 / 总库存量) * 总仓储费
  const rate = Prisma.Decimal.div(orderTotalQty, totalInventory);
  return Prisma.Decimal.mul(rate, totalWarehouseCost);
}

// ============================================================
// 辅助：广告费用分摊
// ============================================================

async function getAdCostAllocation(
  tx: Prisma.TransactionClient,
  order: any,
): Promise<Prisma.Decimal> {
  // 该店铺同期广告总花费
  const adSpend = await tx.adCampaign.aggregate({
    where: {
      storeId: order.storeId,
      startDate: { lte: order.orderedAt },
    },
    _sum: { spend: true },
  });

  const totalAdSpend = adSpend._sum.spend ?? new Prisma.Decimal(0);

  if (totalAdSpend.eq(0)) {
    return new Prisma.Decimal(0);
  }

  // 该店铺同期订单数
  const orderCount = await tx.order.count({
    where: {
      storeId: order.storeId,
      orderedAt: {
        gte: new Date(
          new Date(order.orderedAt).getFullYear(),
          new Date(order.orderedAt).getMonth(),
          1,
        ),
        lte: new Date(
          new Date(order.orderedAt).getFullYear(),
          new Date(order.orderedAt).getMonth() + 1,
          0,
        ),
      },
    },
  });

  if (orderCount === 0) {
    return new Prisma.Decimal(0);
  }

  // 平均分摊到每笔订单
  return Prisma.Decimal.div(totalAdSpend, orderCount);
}

// ============================================================
// 二、订单利润列表
// ============================================================

export async function getOrderProfitList(filters: {
  startDate?: string;
  endDate?: string;
  storeId?: string;
  productId?: string;
  page: number;
  pageSize: number;
}) {
  const where: any = {};

  if (filters.startDate || filters.endDate) {
    where.order = { orderedAt: {} };
    if (filters.startDate) where.order.orderedAt.gte = new Date(filters.startDate);
    if (filters.endDate) where.order.orderedAt.lte = new Date(filters.endDate);
  }

  if (filters.storeId) {
    where.order = { ...where.order, storeId: filters.storeId };
  }

  if (filters.productId) {
    where.order = {
      ...where.order,
      items: { some: { productId: filters.productId } },
    };
  }

  const [data, total] = await Promise.all([
    prisma.orderProfit.findMany({
      where,
      include: {
        order: {
          select: {
            id: true,
            orderNumber: true,
            storeId: true,
            store: { select: { id: true, name: true } },
            items: {
              include: {
                product: { select: { id: true, sku: true, name: true } },
              },
            },
            orderedAt: true,
            currency: true,
          },
        },
      },
      skip: (filters.page - 1) * filters.pageSize,
      take: filters.pageSize,
      orderBy: { calculatedAt: 'desc' },
    }),
    prisma.orderProfit.count({ where }),
  ]);

  return { data, total, page: filters.page, pageSize: filters.pageSize };
}

// ============================================================
// 三、利润汇总
// ============================================================

export async function getProfitSummary(startDate?: string, endDate?: string) {
  const where: any = {};

  if (startDate || endDate) {
    where.order = { orderedAt: {} };
    if (startDate) where.order.orderedAt.gte = new Date(startDate);
    if (endDate) where.order.orderedAt.lte = new Date(endDate);
  }

  const profits = await prisma.orderProfit.findMany({ where });

  const totalRevenue = profits.reduce(
    (sum, p) => sum + Number(p.salesAmount),
    0,
  );
  const totalCost =
    profits.reduce((sum, p) => sum + Number(p.productCost), 0) +
    profits.reduce((sum, p) => sum + Number(p.warehouseCost), 0) +
    profits.reduce((sum, p) => sum + Number(p.platformFee), 0) +
    profits.reduce((sum, p) => sum + Number(p.adFee), 0) +
    profits.reduce((sum, p) => sum + Number(p.logisticsFee), 0) +
    profits.reduce((sum, p) => sum + Number(p.aftersalesFee), 0) +
    profits.reduce((sum, p) => sum + Number(p.taxFee), 0);

  const totalProfit = totalRevenue - totalCost;
  const profitMargin = totalRevenue > 0 ? totalProfit / totalRevenue : 0;
  const orderCount = profits.length;
  const avgProfitPerOrder = orderCount > 0 ? totalProfit / orderCount : 0;

  return {
    totalRevenue,
    totalCost,
    totalProfit,
    profitMargin,
    orderCount,
    avgProfitPerOrder,
  };
}

// ============================================================
// 四、按店铺分组利润
// ============================================================

export async function getStoreProfit(startDate?: string, endDate?: string) {
  const where: any = {};

  if (startDate || endDate) {
    where.order = { orderedAt: {} };
    if (startDate) where.order.orderedAt.gte = new Date(startDate);
    if (endDate) where.order.orderedAt.lte = new Date(endDate);
  }

  const profits = await prisma.orderProfit.findMany({
    where,
    include: {
      order: {
        select: {
          storeId: true,
          store: { select: { id: true, name: true } },
        },
      },
    },
  });

  const storeMap = new Map<string, {
    storeId: string;
    storeName: string;
    revenue: number;
    cost: number;
    profit: number;
    orderCount: number;
  }>();

  for (const p of profits) {
    const storeId = p.order.storeId;
    const storeName = p.order.store.name;

    if (!storeMap.has(storeId)) {
      storeMap.set(storeId, {
        storeId,
        storeName,
        revenue: 0,
        cost: 0,
        profit: 0,
        orderCount: 0,
      });
    }

    const entry = storeMap.get(storeId)!;
    entry.revenue += Number(p.salesAmount);
    entry.cost +=
      Number(p.productCost) +
      Number(p.warehouseCost) +
      Number(p.platformFee) +
      Number(p.adFee) +
      Number(p.logisticsFee) +
      Number(p.aftersalesFee) +
      Number(p.taxFee);
    entry.profit = entry.revenue - entry.cost;
    entry.orderCount += 1;
  }

  return Array.from(storeMap.values()).sort((a, b) => b.profit - a.profit);
}

// ============================================================
// 五、按产品分组利润
// ============================================================

export async function getProductProfit(startDate?: string, endDate?: string) {
  const where: any = {};

  if (startDate || endDate) {
    where.order = { orderedAt: {} };
    if (startDate) where.order.orderedAt.gte = new Date(startDate);
    if (endDate) where.order.orderedAt.lte = new Date(endDate);
  }

  const profits = await prisma.orderProfit.findMany({
    where,
    include: {
      order: {
        include: {
          items: {
            include: {
              product: { select: { id: true, sku: true, name: true } },
            },
          },
        },
      },
    },
  });

  const productMap = new Map<string, {
    productId: string;
    sku: string;
    productName: string;
    revenueShare: number;
    costShare: number;
    profitShare: number;
    orderCount: number;
    totalQuantity: number;
  }>();

  for (const p of profits) {
    const totalItems = p.order.items.length;
    const totalCost =
      Number(p.productCost) +
      Number(p.warehouseCost) +
      Number(p.platformFee) +
      Number(p.adFee) +
      Number(p.logisticsFee) +
      Number(p.aftersalesFee) +
      Number(p.taxFee);

    for (const item of p.order.items) {
      const productId = item.productId;
      // 按商品行金额占比分摊
      const itemAmount = Number(item.totalAmount);
      const orderAmount = Number(p.salesAmount);
      const share = orderAmount > 0 ? itemAmount / orderAmount : 1 / totalItems;

      if (!productMap.has(productId)) {
        productMap.set(productId, {
          productId,
          sku: item.product.sku,
          productName: item.product.name,
          revenueShare: 0,
          costShare: 0,
          profitShare: 0,
          orderCount: 0,
          totalQuantity: 0,
        });
      }

      const entry = productMap.get(productId)!;
      entry.revenueShare += Number(p.salesAmount) * share;
      entry.costShare += totalCost * share;
      entry.profitShare = entry.revenueShare - entry.costShare;
      entry.orderCount += 1;
      entry.totalQuantity += item.quantity;
    }
  }

  return Array.from(productMap.values()).sort((a, b) => b.profitShare - a.profitShare);
}
