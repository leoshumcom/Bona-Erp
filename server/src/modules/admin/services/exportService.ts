import { prisma } from '../../../common/prisma';

// ============================================================
// 通用CSV生成
// ============================================================

/** BOM for UTF-8 CSV */
const BOM = '\uFEFF';

/** 生成CSV字符串 */
export function exportToCSV(
  data: Record<string, any>[],
  columns: { key: string; label: string }[],
): string {
  if (data.length === 0) {
    return BOM + columns.map((c) => escapeCSVField(c.label)).join(',') + '\n';
  }

  const header = columns.map((c) => escapeCSVField(c.label)).join(',');
  const rows = data.map((row) =>
    columns
      .map((col) => {
        const val = row[col.key];
        return escapeCSVField(formatValue(val));
      })
      .join(','),
  );

  return BOM + [header, ...rows].join('\n');
}

/** 转义CSV字段 */
function escapeCSVField(field: string): string {
  if (field.includes(',') || field.includes('"') || field.includes('\n') || field.includes('\r')) {
    return `"${field.replace(/"/g, '""')}"`;
  }
  return field;
}

/** 格式化值 */
function formatValue(val: any): string {
  if (val === null || val === undefined) return '';
  if (val instanceof Date) return val.toISOString().slice(0, 10);
  if (typeof val === 'object' && val !== null) return JSON.stringify(val);
  return String(val);
}

// ============================================================
// 导出订单
// ============================================================
export async function exportOrders(filters: {
  startDate?: string;
  endDate?: string;
  storeId?: string;
}) {
  const where: any = {};

  if (filters.storeId) where.storeId = filters.storeId;
  if (filters.startDate || filters.endDate) {
    where.orderedAt = {};
    if (filters.startDate) where.orderedAt.gte = new Date(filters.startDate);
    if (filters.endDate) where.orderedAt.lte = new Date(filters.endDate);
  }

  const orders = await prisma.order.findMany({
    where,
    include: {
      store: { select: { name: true } },
      items: {
        include: {
          product: { select: { sku: true } },
        },
      },
    },
    orderBy: { orderedAt: 'desc' },
    take: 5000,
  });

  const rows: Record<string, any>[] = [];

  for (const order of orders) {
    if (order.items.length === 0) {
      rows.push({
        orderNumber: order.orderNumber,
        storeName: order.store.name,
        productSku: '',
        quantity: 0,
        amount: Number(order.totalAmount),
        status: order.status,
        date: order.orderedAt,
      });
    } else {
      for (const item of order.items) {
        rows.push({
          orderNumber: order.orderNumber,
          storeName: order.store.name,
          productSku: item.product.sku,
          quantity: item.quantity,
          amount: Number(item.totalAmount),
          status: order.status,
          date: order.orderedAt,
        });
      }
    }
  }

  const columns = [
    { key: 'orderNumber', label: '订单号' },
    { key: 'storeName', label: '店铺' },
    { key: 'productSku', label: '产品SKU' },
    { key: 'quantity', label: '数量' },
    { key: 'amount', label: '金额' },
    { key: 'status', label: '状态' },
    { key: 'date', label: '日期' },
  ];

  return exportToCSV(rows, columns);
}

// ============================================================
// 导出库存
// ============================================================
export async function exportInventory() {
  const balances = await prisma.inventoryBalance.findMany({
    where: { quantityOnHand: { gt: 0 } as any },
    include: {
      product: { select: { sku: true, name: true } },
      storageLocation: { select: { code: true } },
    },
    orderBy: { productId: 'asc' },
  });

  const rows = balances.map((b) => ({
    productSku: b.product.sku,
    productName: b.product.name,
    locationCode: b.storageLocation.code,
    batchNo: '',
    quantity: Number(b.quantityOnHand),
    unitCost: Number(b.totalCost) > 0 ? Number(b.totalCost) / Number(b.quantityOnHand) : 0,
    totalCost: Number(b.totalCost),
  }));

  const columns = [
    { key: 'productSku', label: '产品SKU' },
    { key: 'productName', label: '产品名' },
    { key: 'locationCode', label: '库位' },
    { key: 'batchNo', label: '批次号' },
    { key: 'quantity', label: '数量' },
    { key: 'unitCost', label: '单位成本' },
    { key: 'totalCost', label: '总成本' },
  ];

  return exportToCSV(rows, columns);
}

// ============================================================
// 导出利润
// ============================================================
export async function exportProfit(filters: {
  startDate?: string;
  endDate?: string;
  storeId?: string;
}) {
  const where: any = {};

  if (filters.storeId) {
    where.order = { storeId: filters.storeId };
  }

  if (filters.startDate || filters.endDate) {
    where.calculatedAt = {};
    if (filters.startDate) where.calculatedAt.gte = new Date(filters.startDate);
    if (filters.endDate) where.calculatedAt.lte = new Date(filters.endDate);
  }

  const profits = await prisma.orderProfit.findMany({
    where,
    include: {
      order: {
        select: { orderNumber: true, storeId: true },
      },
    },
    orderBy: { calculatedAt: 'desc' },
    take: 5000,
  });

  const rows = profits.map((p) => {
    const sales = Number(p.salesAmount);
    const refund = Number(p.refundAmount);
    const revenue = sales - refund;
    const productCost = Number(p.productCost);
    const warehouseCost = Number(p.warehouseCost);
    const adFee = Number(p.adFee);
    const platformFee = Number(p.platformFee);
    const logisticsFee = Number(p.logisticsFee);
    const aftersalesFee = Number(p.aftersalesFee);
    const netProfit = Number(p.netProfit);
    const margin = Number(p.profitMargin);

    return {
      orderNumber: p.order.orderNumber,
      revenue: revenue.toFixed(2),
      productCost: productCost.toFixed(2),
      warehouseCost: warehouseCost.toFixed(2),
      adFee: adFee.toFixed(2),
      platformFee: platformFee.toFixed(2),
      logisticsFee: logisticsFee.toFixed(2),
      aftersalesFee: aftersalesFee.toFixed(2),
      netProfit: netProfit.toFixed(2),
      profitMargin: (margin * 100).toFixed(2) + '%',
    };
  });

  const columns = [
    { key: 'orderNumber', label: '订单号' },
    { key: 'revenue', label: '收入' },
    { key: 'productCost', label: '生产成本' },
    { key: 'warehouseCost', label: '仓储' },
    { key: 'adFee', label: '广告' },
    { key: 'platformFee', label: '平台费' },
    { key: 'logisticsFee', label: '物流' },
    { key: 'aftersalesFee', label: '售后' },
    { key: 'netProfit', label: '净利润' },
    { key: 'profitMargin', label: '利润率' },
  ];

  return exportToCSV(rows, columns);
}

// ============================================================
// 导出用户
// ============================================================
export async function exportUsers() {
  const users = await prisma.user.findMany({
    select: {
      username: true,
      realName: true,
      email: true,
      role: true,
      status: true,
      company: { select: { name: true } },
    },
    orderBy: { createdAt: 'asc' },
  });

  const rows = users.map((u) => ({
    username: u.username,
    realName: u.realName,
    email: u.email || '',
    role: u.role,
    companyName: u.company.name,
    status: u.status === 'active' ? '正常' : '已禁用',
  }));

  const columns = [
    { key: 'username', label: '用户名' },
    { key: 'realName', label: '姓名' },
    { key: 'email', label: '邮箱' },
    { key: 'role', label: '角色' },
    { key: 'companyName', label: '公司' },
    { key: 'status', label: '状态' },
  ];

  return exportToCSV(rows, columns);
}
