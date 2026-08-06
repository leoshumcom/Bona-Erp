import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ============================================================
// 工具函数
// ============================================================

/** 将 Prisma Decimal 转为 number */
function toNum(v: any): number {
  if (v === null || v === undefined) return 0;
  if (typeof v === 'number') return v;
  return Number(v.toString());
}

/** 获取某天的起止时间（UTC） */
function dayRange(date: Date): { start: Date; end: Date } {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  const start = new Date(d);
  d.setUTCHours(23, 59, 59, 999);
  const end = new Date(d);
  return { start, end };
}

/** 获取当月第一天 00:00 和当月最后一天 23:59 */
function monthRange(date: Date): { start: Date; end: Date } {
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth();
  return {
    start: new Date(Date.UTC(y, m, 1, 0, 0, 0, 0)),
    end: new Date(Date.UTC(y, m + 1, 0, 23, 59, 59, 999)),
  };
}

/** 获取上月范围 */
function lastMonthRange(date: Date): { start: Date; end: Date } {
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth();
  return {
    start: new Date(Date.UTC(y, m - 1, 1, 0, 0, 0, 0)),
    end: new Date(Date.UTC(y, m, 0, 23, 59, 59, 999)),
  };
}

/** 日期偏移天 */
function daysAgo(n: number): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - n);
  return d;
}

/** 获取本周范围（周一~周日） */
function weekRange(date: Date): { start: Date; end: Date } {
  const d = new Date(date);
  const day = d.getUTCDay();
  const diff = day === 0 ? 6 : day - 1; // 周一为起始
  const start = new Date(d);
  start.setUTCDate(d.getUTCDate() - diff);
  start.setUTCHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + 6);
  end.setUTCHours(23, 59, 59, 999);
  return { start, end };
}

/** 获取上周范围 */
function lastWeekRange(date: Date): { start: Date; end: Date } {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() - 7);
  return weekRange(d);
}

// ============================================================
// 1. 每日经营快照
// ============================================================

export async function getDailySnapshot(dateStr?: string) {
  const targetDate = dateStr ? new Date(dateStr) : new Date();
  const { start: todayStart, end: todayEnd } = dayRange(targetDate);
  const { start: monthStart, end: monthEnd } = monthRange(targetDate);
  const { start: lastMonthStart, end: lastMonthEnd } = lastMonthRange(targetDate);

  // 并行查询
  const [
    todayOrders,
    monthOrders,
    lastMonthOrders,
    todayShipped,
    todayDelivered,
    todayProfit,
    monthProfit,
    lastMonthProfit,
    lastMonthRevenue,
    costsAgg,
    inventoryTotal,
    skuCount,
    lowStockCount,
    monthRevenueResult,
    todayRevenueResult,
  ] = await Promise.all([
    // 今日订单
    prisma.order.count({ where: { createdAt: { gte: todayStart, lte: todayEnd }, status: { not: 'CANCELLED' } } }),
    // 本月订单
    prisma.order.count({ where: { createdAt: { gte: monthStart, lte: monthEnd }, status: { not: 'CANCELLED' } } }),
    // 上月订单
    prisma.order.count({ where: { createdAt: { gte: lastMonthStart, lte: lastMonthEnd }, status: { not: 'CANCELLED' } } }),
    // 今日已发货
    prisma.order.count({ where: { shippedAt: { gte: todayStart, lte: todayEnd }, status: 'SHIPPED' } }),
    // 今日已签收
    prisma.order.count({ where: { deliveredAt: { gte: todayStart, lte: todayEnd }, status: 'DELIVERED' } }),
    // 今日利润
    prisma.orderProfit.aggregate({
      _sum: { grossProfit: true, netProfit: true },
      where: { createdAt: { gte: todayStart, lte: todayEnd } },
    }),
    // 本月利润
    prisma.orderProfit.aggregate({
      _sum: { grossProfit: true, netProfit: true },
      where: { createdAt: { gte: monthStart, lte: monthEnd } },
    }),
    // 上月利润
    prisma.orderProfit.aggregate({
      _sum: { netProfit: true },
      where: { createdAt: { gte: lastMonthStart, lte: lastMonthEnd } },
    }),
    // 上月收入
    prisma.order.aggregate({
      _sum: { totalAmount: true },
      where: { createdAt: { gte: lastMonthStart, lte: lastMonthEnd }, status: { not: 'CANCELLED' } },
    }),
    // 本月成本明细
    prisma.orderProfit.aggregate({
      _sum: {
        productCost: true,
        warehouseCost: true,
        adFee: true,
        platformFee: true,
        logisticsFee: true,
        aftersalesFee: true,
      },
      where: { createdAt: { gte: monthStart, lte: monthEnd } },
    }),
    // 库存总价值
    prisma.inventoryBalance.aggregate({ _sum: { totalCost: true } }),
    // SKU数量（有库存的）
    prisma.inventoryBalance.findMany({ where: { quantityOnHand: { gt: 0 } }, distinct: ['productId'], select: { productId: true } }),
    // 低库存SKU数
    prisma.inventoryBalance.findMany({ where: { quantityOnHand: { lt: 10 } }, distinct: ['productId'], select: { productId: true } }),
    // 本月收入
    prisma.order.aggregate({
      _sum: { totalAmount: true },
      where: { createdAt: { gte: monthStart, lte: monthEnd }, status: { not: 'CANCELLED' } },
    }),
    // 今日收入
    prisma.order.aggregate({
      _sum: { totalAmount: true },
      where: { createdAt: { gte: todayStart, lte: todayEnd }, status: { not: 'CANCELLED' } },
    }),
  ]);

  const monthRevenue = toNum(monthRevenueResult._sum.totalAmount);
  const lastMonthRev = toNum(lastMonthRevenue._sum.totalAmount);
  const lastMonthNetProfit = toNum(lastMonthProfit._sum.netProfit);
  const monthNetProfit = toNum(monthProfit._sum.netProfit);

  const growth = lastMonthRev > 0
    ? Number((((monthRevenue - lastMonthRev) / lastMonthRev) * 100).toFixed(1))
    : 0;

  const netProfitVal = monthNetProfit;
  const margin = monthRevenue > 0
    ? Number(((netProfitVal / monthRevenue) * 100).toFixed(1))
    : 0;

  return {
    date: targetDate.toISOString().slice(0, 10),
    revenue: {
      today: toNum(todayRevenueResult._sum.totalAmount),
      month: monthRevenue,
      growth,
    },
    orders: {
      today: todayOrders,
      shipped: todayShipped,
      delivered: todayDelivered,
    },
    profit: {
      gross: toNum(todayProfit._sum.grossProfit),
      net: netProfitVal,
      margin,
    },
    costs: {
      production: toNum(costsAgg._sum.productCost),
      warehouse: toNum(costsAgg._sum.warehouseCost),
      ad: toNum(costsAgg._sum.adFee),
      platform: toNum(costsAgg._sum.platformFee),
      logistics: toNum(costsAgg._sum.logisticsFee),
      aftersales: toNum(costsAgg._sum.aftersalesFee),
    },
    inventory: {
      totalValue: toNum(inventoryTotal._sum.totalCost),
      skuCount: skuCount.length,
      lowStockCount: lowStockCount.length,
    },
  };
}

// ============================================================
// 2. 收入趋势
// ============================================================

export async function getRevenueTrend(period: '7d' | '30d' | '12m') {
  if (period === '12m') {
    // 按月聚合，最近12个月
    const months: { start: Date; end: Date }[] = [];
    const now = new Date();
    for (let i = 11; i >= 0; i--) {
      const y = now.getUTCFullYear();
      const m = now.getUTCMonth() - i;
      const d = new Date(Date.UTC(y, m, 1));
      months.push(monthRange(d));
    }

    const results = await Promise.all(
      months.map(async (mr) => {
        const [rev, orders, profit] = await Promise.all([
          prisma.order.aggregate({
            _sum: { totalAmount: true },
            where: { createdAt: { gte: mr.start, lte: mr.end }, status: { not: 'CANCELLED' } },
          }),
          prisma.order.count({
            where: { createdAt: { gte: mr.start, lte: mr.end }, status: { not: 'CANCELLED' } },
          }),
          prisma.orderProfit.aggregate({
            _sum: { netProfit: true },
            where: { createdAt: { gte: mr.start, lte: mr.end } },
          }),
        ]);
        return {
          date: mr.start.toISOString().slice(0, 7),
          revenue: toNum(rev._sum.totalAmount),
          orders,
          profit: toNum(profit._sum.netProfit),
        };
      }),
    );
    return results;
  }

  // 按天聚合
  const days = period === '7d' ? 7 : 30;
  const dayRanges: { date: string; start: Date; end: Date }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = daysAgo(i);
    const { start, end } = dayRange(d);
    dayRanges.push({ date: d.toISOString().slice(0, 10), start, end });
  }

  const results = await Promise.all(
    dayRanges.map(async (dr) => {
      const [rev, orders, profit] = await Promise.all([
        prisma.order.aggregate({
          _sum: { totalAmount: true },
          where: { createdAt: { gte: dr.start, lte: dr.end }, status: { not: 'CANCELLED' } },
        }),
        prisma.order.count({
          where: { createdAt: { gte: dr.start, lte: dr.end }, status: { not: 'CANCELLED' } },
        }),
        prisma.orderProfit.aggregate({
          _sum: { netProfit: true },
          where: { createdAt: { gte: dr.start, lte: dr.end } },
        }),
      ]);
      return {
        date: dr.date,
        revenue: toNum(rev._sum.totalAmount),
        orders,
        profit: toNum(profit._sum.netProfit),
      };
    }),
  );
  return results;
}

// ============================================================
// 3. 店铺业绩
// ============================================================

export async function getStorePerformance(startDate?: string, endDate?: string) {
  const now = new Date();
  const start = startDate ? new Date(startDate) : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end = endDate ? new Date(endDate) : now;

  const stores = await prisma.store.findMany({
    where: { status: 'active' },
    include: { platform: true },
  });

  const results = await Promise.all(
    stores.map(async (store) => {
      const [orderAgg, profitAgg, adAgg] = await Promise.all([
        prisma.order.aggregate({
          _sum: { totalAmount: true },
          _count: true,
          where: {
            storeId: store.id,
            createdAt: { gte: start, lte: end },
            status: { not: 'CANCELLED' },
          },
        }),
        prisma.orderProfit.aggregate({
          _sum: { netProfit: true },
          where: {
            order: { storeId: store.id, createdAt: { gte: start, lte: end }, status: { not: 'CANCELLED' } },
          },
        }),
        prisma.adCampaign.aggregate({
          _sum: { spend: true },
          where: { storeId: store.id, startDate: { gte: start, lte: end } },
        }),
      ]);

      const revenue = toNum(orderAgg._sum.totalAmount);
      const orderCount = orderAgg._count;
      const profit = toNum(profitAgg._sum.netProfit);
      const adCost = toNum(adAgg._sum.spend);

      return {
        storeId: store.id,
        storeName: store.name,
        platform: store.platform.name,
        revenue,
        orderCount,
        profit,
        profitMargin: revenue > 0 ? Number(((profit / revenue) * 100).toFixed(1)) : 0,
        adCost,
        adROAS: adCost > 0 ? Number((revenue / adCost).toFixed(2)) : 0,
      };
    }),
  );

  return results.sort((a, b) => b.revenue - a.revenue);
}

// ============================================================
// 4. 产品盈利能力
// ============================================================

export async function getProductProfitability(startDate?: string, endDate?: string) {
  const now = new Date();
  const start = startDate ? new Date(startDate) : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end = endDate ? new Date(endDate) : now;

  const products = await prisma.product.findMany({
    where: { status: 'active', materialType: 'FINISHED_GOOD' },
    select: { id: true, sku: true, name: true, standardCost: true },
  });

  const results = await Promise.all(
    products.map(async (product) => {
      const orderItems = await prisma.orderItem.aggregate({
        _sum: { totalAmount: true, quantity: true },
        where: {
          productId: product.id,
          order: {
            createdAt: { gte: start, lte: end },
            status: { not: 'CANCELLED' },
          },
        },
      });

      const revenue = toNum(orderItems._sum.totalAmount);
      const unitsSold = orderItems._sum.quantity || 0;
      const standardCost = toNum(product.standardCost);
      const cost = standardCost * unitsSold;
      const profit = revenue - cost;

      return {
        productId: product.id,
        sku: product.sku,
        name: product.name,
        revenue,
        cost,
        profit,
        margin: revenue > 0 ? Number(((profit / revenue) * 100).toFixed(1)) : 0,
        unitsSold,
      };
    }),
  );

  return results.sort((a, b) => b.profit - a.profit).slice(0, 50);
}

// ============================================================
// 5. 成本结构
// ============================================================

export async function getCostStructure(startDate?: string, endDate?: string) {
  const now = new Date();
  const start = startDate ? new Date(startDate) : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end = endDate ? new Date(endDate) : now;

  const costAgg = await prisma.orderProfit.aggregate({
    _sum: {
      productCost: true,
      warehouseCost: true,
      adFee: true,
      platformFee: true,
      logisticsFee: true,
      aftersalesFee: true,
    },
    where: { createdAt: { gte: start, lte: end } },
  });

  const categories = [
    { category: '生产成本', amount: toNum(costAgg._sum.productCost) },
    { category: '仓储费用', amount: toNum(costAgg._sum.warehouseCost) },
    { category: '广告费用', amount: toNum(costAgg._sum.adFee) },
    { category: '平台佣金', amount: toNum(costAgg._sum.platformFee) },
    { category: '物流费用', amount: toNum(costAgg._sum.logisticsFee) },
    { category: '售后费用', amount: toNum(costAgg._sum.aftersalesFee) },
  ];

  const total = categories.reduce((sum, c) => sum + c.amount, 0);

  return categories.map((c) => ({
    ...c,
    percentage: total > 0 ? Number(((c.amount / total) * 100).toFixed(1)) : 0,
  }));
}

// ============================================================
// 6. 业务预警
// ============================================================

export async function getAlerts() {
  const alerts: {
    type: 'INVENTORY_LOW' | 'PROFIT_DECLINE' | 'AD_ROAS_FALL' | 'ORDER_DECLINE' | 'RETURN_RATE_HIGH';
    severity: 'WARNING' | 'CRITICAL';
    message: string;
    value: number;
    threshold: number;
    trend: string;
  }[] = [];

  const now = new Date();

  // 1) 库存偏低预警
  const lowStockProducts = await prisma.inventoryBalance.findMany({
    where: { quantityOnHand: { lt: 10 } },
    distinct: ['productId'],
    select: { productId: true, product: { select: { sku: true, name: true } } },
  });

  if (lowStockProducts.length > 0) {
    const names = lowStockProducts.slice(0, 5).map((p) => p.product.sku).join('、');
    const more = lowStockProducts.length > 5 ? `等${lowStockProducts.length}个SKU` : '';
    alerts.push({
      type: 'INVENTORY_LOW',
      severity: lowStockProducts.length >= 5 ? 'CRITICAL' : 'WARNING',
      message: `库存不足: ${names}${more}当前库存低于10件`,
      value: lowStockProducts.length,
      threshold: 10,
      trend: '需补货',
    });
  }

  // 2) 利润下滑预警（本周 vs 上周）
  const { start: thisWeekStart, end: thisWeekEnd } = weekRange(now);
  const { start: lastWeekStart, end: lastWeekEnd } = lastWeekRange(now);

  const [thisWeekProfit, lastWeekProfit] = await Promise.all([
    prisma.orderProfit.aggregate({
      _sum: { netProfit: true },
      where: { createdAt: { gte: thisWeekStart, lte: thisWeekEnd } },
    }),
    prisma.orderProfit.aggregate({
      _sum: { netProfit: true },
      where: { createdAt: { gte: lastWeekStart, lte: lastWeekEnd } },
    }),
  ]);

  const twp = toNum(thisWeekProfit._sum.netProfit);
  const lwp = toNum(lastWeekProfit._sum.netProfit);

  if (lwp > 0) {
    const decline = Number((((lwp - twp) / lwp) * 100).toFixed(1));
    if (decline > 20) {
      alerts.push({
        type: 'PROFIT_DECLINE',
        severity: decline > 40 ? 'CRITICAL' : 'WARNING',
        message: `本周净利润较上周下降${decline}%`,
        value: decline,
        threshold: 20,
        trend: '下降',
      });
    }
  }

  // 3) 广告ROAS下降预警
  const sevenDaysAgo = daysAgo(7);
  const lowRoasCampaigns = await prisma.adCampaign.findMany({
    where: {
      startDate: { gte: sevenDaysAgo },
      roas: { lt: 1.0 },
    },
    select: { campaignName: true, roas: true, spend: true, sales: true },
  });

  if (lowRoasCampaigns.length > 0) {
    const worst = lowRoasCampaigns.reduce((a, b) =>
      toNum(a.roas) < toNum(b.roas) ? a : b,
    );
    alerts.push({
      type: 'AD_ROAS_FALL',
      severity: lowRoasCampaigns.length >= 3 ? 'CRITICAL' : 'WARNING',
      message: `广告ROAS偏低: ${worst.campaignName} ROAS=${toNum(worst.roas).toFixed(2)}，${lowRoasCampaigns.length}个广告投放效果不佳`,
      value: toNum(worst.roas),
      threshold: 1.0,
      trend: '下降',
    });
  }

  // 4) 订单趋势下滑预警
  const [recent7dOrders, prior7dOrders] = await Promise.all([
    prisma.order.count({
      where: {
        createdAt: { gte: daysAgo(7), lte: now },
        status: { not: 'CANCELLED' },
      },
    }),
    prisma.order.count({
      where: {
        createdAt: { gte: daysAgo(14), lt: daysAgo(7) },
        status: { not: 'CANCELLED' },
      },
    }),
  ]);

  if (prior7dOrders > 0) {
    const orderDecline = Number((((prior7dOrders - recent7dOrders) / prior7dOrders) * 100).toFixed(1));
    if (orderDecline > 15) {
      alerts.push({
        type: 'ORDER_DECLINE',
        severity: orderDecline > 30 ? 'CRITICAL' : 'WARNING',
        message: `近7天订单量较前7天下降${orderDecline}%`,
        value: orderDecline,
        threshold: 15,
        trend: '下降',
      });
    }
  }

  // 5) 退货率偏高预警
  const [totalOrders, afterSalesCount] = await Promise.all([
    prisma.order.count({ where: { createdAt: { gte: daysAgo(30) }, status: { not: 'CANCELLED' } } }),
    prisma.afterSales.count({ where: { createdAt: { gte: daysAgo(30) } } }),
  ]);

  if (totalOrders > 0) {
    const returnRate = Number(((afterSalesCount / totalOrders) * 100).toFixed(1));
    if (returnRate > 5) {
      alerts.push({
        type: 'RETURN_RATE_HIGH',
        severity: returnRate > 10 ? 'CRITICAL' : 'WARNING',
        message: `近30天退货率${returnRate}%，超过5%警戒线`,
        value: returnRate,
        threshold: 5,
        trend: '偏高',
      });
    }
  }

  return alerts.sort((a, b) => {
    const sev = { CRITICAL: 0, WARNING: 1 };
    return (sev[a.severity] ?? 0) - (sev[b.severity] ?? 0);
  });
}

// ============================================================
// 7. KPI指标卡片
// ============================================================

export async function getKPIOverview() {
  const now = new Date();
  const { start: monthStart, end: monthEnd } = monthRange(now);
  const { start: lastMonthStart, end: lastMonthEnd } = lastMonthRange(now);

  // 本月数据
  const [monthRev, monthProfit, monthOrders, lastMonthRev, lastMonthProfit, lastMonthOrders] = await Promise.all([
    prisma.order.aggregate({
      _sum: { totalAmount: true },
      where: { createdAt: { gte: monthStart, lte: monthEnd }, status: { not: 'CANCELLED' } },
    }),
    prisma.orderProfit.aggregate({
      _sum: { netProfit: true },
      where: { createdAt: { gte: monthStart, lte: monthEnd } },
    }),
    prisma.order.count({
      where: { createdAt: { gte: monthStart, lte: monthEnd }, status: { not: 'CANCELLED' } },
    }),
    prisma.order.aggregate({
      _sum: { totalAmount: true },
      where: { createdAt: { gte: lastMonthStart, lte: lastMonthEnd }, status: { not: 'CANCELLED' } },
    }),
    prisma.orderProfit.aggregate({
      _sum: { netProfit: true },
      where: { createdAt: { gte: lastMonthStart, lte: lastMonthEnd } },
    }),
    prisma.order.count({
      where: { createdAt: { gte: lastMonthStart, lte: lastMonthEnd }, status: { not: 'CANCELLED' } },
    }),
  ]);

  const revenue = toNum(monthRev._sum.totalAmount);
  const profit = toNum(monthProfit._sum.netProfit);
  const orders = monthOrders;
  const lastRev = toNum(lastMonthRev._sum.totalAmount);
  const lastProfit = toNum(lastMonthProfit._sum.netProfit);
  const lastOrders = lastMonthOrders;

  // 环比变化
  function pctChange(current: number, previous: number): number {
    if (previous === 0) return current > 0 ? 100 : 0;
    return Number((((current - previous) / previous) * 100).toFixed(1));
  }

  function trend(current: number, previous: number): 'up' | 'down' {
    return current >= previous ? 'up' : 'down';
  }

  const avgOrderValue = orders > 0 ? Number((revenue / orders).toFixed(2)) : 0;
  const lastAvgOrderValue = lastOrders > 0 ? Number((lastRev / lastOrders).toFixed(2)) : 0;
  const profitMargin = revenue > 0 ? Number(((profit / revenue) * 100).toFixed(1)) : 0;
  const lastProfitMargin = lastRev > 0 ? Number(((lastProfit / lastRev) * 100).toFixed(1)) : 0;

  // 库存周转率 = 本月销售成本 / 平均库存
  const [monthCost, avgInventory] = await Promise.all([
    prisma.orderProfit.aggregate({
      _sum: { productCost: true },
      where: { createdAt: { gte: monthStart, lte: monthEnd } },
    }),
    prisma.inventoryBalance.aggregate({ _sum: { totalCost: true } }),
  ]);

  const cogs = toNum(monthCost._sum.productCost);
  const avgInv = toNum(avgInventory._sum.totalCost);
  const inventoryTurnover = avgInv > 0 ? Number((cogs / avgInv).toFixed(2)) : 0;

  // 上月库存周转率（用上月成本）
  const lastMonthCost = await prisma.orderProfit.aggregate({
    _sum: { productCost: true },
    where: { createdAt: { gte: lastMonthStart, lte: lastMonthEnd } },
  });
  const lastCogs = toNum(lastMonthCost._sum.productCost);
  const lastInventoryTurnover = avgInv > 0 ? Number((lastCogs / avgInv).toFixed(2)) : 0;

  // 退货率
  const [afterSalesCount, monthTotalOrders] = await Promise.all([
    prisma.afterSales.count({ where: { createdAt: { gte: monthStart, lte: monthEnd } } }),
    prisma.order.count({ where: { createdAt: { gte: monthStart, lte: monthEnd } } }),
  ]);
  const returnRate = monthTotalOrders > 0 ? Number(((afterSalesCount / monthTotalOrders) * 100).toFixed(1)) : 0;

  const lastMonthAfterSales = await prisma.afterSales.count({
    where: { createdAt: { gte: lastMonthStart, lte: lastMonthEnd } },
  });
  const lastMonthTotalOrders = await prisma.order.count({
    where: { createdAt: { gte: lastMonthStart, lte: lastMonthEnd } },
  });
  const lastReturnRate = lastMonthTotalOrders > 0
    ? Number(((lastMonthAfterSales / lastMonthTotalOrders) * 100).toFixed(1))
    : 0;

  return {
    revenue: {
      value: revenue,
      change: pctChange(revenue, lastRev),
      trend: trend(revenue, lastRev),
    },
    profit: {
      value: profit,
      change: pctChange(profit, lastProfit),
      trend: trend(profit, lastProfit),
    },
    orders: {
      value: orders,
      change: pctChange(orders, lastOrders),
      trend: trend(orders, lastOrders),
    },
    avgOrderValue: {
      value: avgOrderValue,
      change: pctChange(avgOrderValue, lastAvgOrderValue),
      trend: trend(avgOrderValue, lastAvgOrderValue),
    },
    profitMargin: {
      value: profitMargin,
      change: pctChange(profitMargin, lastProfitMargin),
      trend: trend(profitMargin, lastProfitMargin),
    },
    inventoryTurnover: {
      value: inventoryTurnover,
      change: pctChange(inventoryTurnover, lastInventoryTurnover),
      trend: trend(inventoryTurnover, lastInventoryTurnover),
    },
    returnRate: {
      value: returnRate,
      change: pctChange(returnRate, lastReturnRate),
      trend: trend(lastReturnRate, returnRate),
    },
  };
}
