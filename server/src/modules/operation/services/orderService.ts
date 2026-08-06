import { Prisma } from '@prisma/client';
import { prisma } from '../../../common/prisma';

// ============================================================
// 工具函数
// ============================================================

/** 生成订单号: ORD-YYYYMMDD-{seq} */
function generateOrderNumber(): string {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const seq = Date.now().toString(36).toUpperCase().slice(-5);
  return `ORD-${date}-${seq}`;
}

/** 写入审计日志 */
function writeAuditLog(
  tx: Prisma.TransactionClient,
  params: {
    entityType: string;
    entityId: string;
    action: string;
    actorId: string;
    afterState?: Record<string, unknown>;
  },
) {
  return tx.auditLog.create({
    data: {
      entityType: params.entityType,
      entityId: params.entityId,
      action: params.action,
      actorId: params.actorId,
      afterState: params.afterState as any ?? undefined,
    },
  });
}

// ============================================================
// 一、创建订单
// ============================================================

export async function createOrder(
  userId: string,
  params: {
    storeId: string;
    platformOrderId?: string;
    customerName?: string;
    customerEmail?: string;
    country?: string;
    currency?: string;
    items: Array<{ productId: string; quantity: number; unitPrice: number }>;
    orderedAt: string;
    internalNote?: string;
    warehouseId?: string;
  },
) {
  const orderNumber = generateOrderNumber();

  const result = await prisma.$transaction(async (tx) => {
    // 1. 验证店铺和产品存在
    await tx.store.findUniqueOrThrow({ where: { id: params.storeId } });

    for (const item of params.items) {
      await tx.product.findUniqueOrThrow({ where: { id: item.productId } });
    }

    // 2. 计算订单总金额
    const totalAmount = params.items.reduce(
      (sum, item) => sum + item.quantity * item.unitPrice,
      0,
    );

    // 3. 创建订单
    const order = await tx.order.create({
      data: {
        orderNumber,
        storeId: params.storeId,
        platformOrderId: params.platformOrderId,
        customerName: params.customerName,
        customerEmail: params.customerEmail,
        country: params.country || 'CN',
        currency: params.currency || 'CNY',
        totalAmount: new Prisma.Decimal(totalAmount),
        status: 'PENDING_REVIEW',
        paymentStatus: 'PAID',
        orderedAt: new Date(params.orderedAt),
        internalNote: params.internalNote,
        warehouseId: params.warehouseId,
      },
    });

    // 4. 创建订单明细行
    const orderItems = [];
    for (const item of params.items) {
      const orderItem = await tx.orderItem.create({
        data: {
          orderId: order.id,
          productId: item.productId,
          quantity: item.quantity,
          unitPrice: new Prisma.Decimal(item.unitPrice),
          totalAmount: new Prisma.Decimal(item.quantity * item.unitPrice),
        },
      });
      orderItems.push(orderItem);
    }

    // 5. 审计日志
    await writeAuditLog(tx, {
      entityType: 'Order',
      entityId: order.id,
      action: 'CREATE',
      actorId: userId,
      afterState: { orderNumber, storeId: params.storeId, totalAmount, itemCount: params.items.length },
    });

    return { order, items: orderItems };
  });

  return result;
}

// ============================================================
// 二、订单查询
// ============================================================

export async function getOrders(filters: {
  storeId?: string;
  productId?: string;
  status?: string;
  paymentStatus?: string;
  shippingStatus?: string;
  startDate?: string;
  endDate?: string;
  keyword?: string;
  page: number;
  pageSize: number;
}) {
  const where: any = {};

  if (filters.storeId) where.storeId = filters.storeId;
  if (filters.status) where.status = filters.status;
  if (filters.paymentStatus) where.paymentStatus = filters.paymentStatus;
  if (filters.shippingStatus) where.shippingStatus = filters.shippingStatus;

  if (filters.startDate || filters.endDate) {
    where.orderedAt = {};
    if (filters.startDate) where.orderedAt.gte = new Date(filters.startDate);
    if (filters.endDate) where.orderedAt.lte = new Date(filters.endDate);
  }

  if (filters.keyword) {
    where.OR = [
      { orderNumber: { contains: filters.keyword, mode: 'insensitive' } },
      { platformOrderId: { contains: filters.keyword, mode: 'insensitive' } },
      { customerName: { contains: filters.keyword, mode: 'insensitive' } },
    ];
  }

  // 按产品筛选：通过 OrderItem 关联
  if (filters.productId) {
    where.items = { some: { productId: filters.productId } };
  }

  const [data, total] = await Promise.all([
    prisma.order.findMany({
      where,
      include: {
        store: { select: { id: true, name: true } },
        items: {
          include: {
            product: { select: { id: true, sku: true, name: true } },
          },
        },
        warehouse: { select: { id: true, code: true, name: true } },
        logistics: { select: { id: true, trackingNumber: true, carrier: true, status: true } },
      },
      skip: (filters.page - 1) * filters.pageSize,
      take: filters.pageSize,
      orderBy: { orderedAt: 'desc' },
    }),
    prisma.order.count({ where }),
  ]);

  return { data, total, page: filters.page, pageSize: filters.pageSize };
}

// ============================================================
// 三、订单详情
// ============================================================

export async function getOrderDetail(id: string) {
  const order = await prisma.order.findUniqueOrThrow({
    where: { id },
    include: {
      store: { select: { id: true, name: true, storeId: true } },
      items: {
        include: {
          product: { select: { id: true, sku: true, name: true, materialType: true } },
        },
      },
      warehouse: { select: { id: true, code: true, name: true } },
      fees: true,
      logistics: true,
      finance: true,
    },
  });

  return order;
}

// ============================================================
// 四、批量导入订单
// ============================================================

export async function importOrders(
  userId: string,
  orders: Array<{
    storeId: string;
    platformOrderId?: string;
    customerName?: string;
    customerEmail?: string;
    country?: string;
    currency?: string;
    items: Array<{ productId: string; quantity: number; unitPrice: number }>;
    orderedAt: string;
    internalNote?: string;
    warehouseId?: string;
  }>,
) {
  const results: Array<{ success: boolean; orderNumber?: string; error?: string }> = [];

  for (const orderData of orders) {
    try {
      const result = await createOrder(userId, orderData);
      results.push({ success: true, orderNumber: result.order.orderNumber });
    } catch (err: any) {
      results.push({ success: false, error: err.message || '导入失败' });
    }
  }

  return {
    total: orders.length,
    successCount: results.filter((r) => r.success).length,
    failCount: results.filter((r) => !r.success).length,
    results,
  };
}

// ============================================================
// 五、订单费用
// ============================================================

export async function addOrderFee(
  userId: string,
  params: {
    orderId: string;
    feeType: string;
    amount: number;
    notes?: string;
  },
) {
  const result = await prisma.$transaction(async (tx) => {
    // 验证订单存在
    await tx.order.findUniqueOrThrow({ where: { id: params.orderId } });

    const fee = await tx.orderFee.create({
      data: {
        orderId: params.orderId,
        feeType: params.feeType,
        amount: new Prisma.Decimal(params.amount),
        notes: params.notes,
      },
    });

    await writeAuditLog(tx, {
      entityType: 'OrderFee',
      entityId: fee.id,
      action: 'CREATE',
      actorId: userId,
      afterState: { orderId: params.orderId, feeType: params.feeType, amount: params.amount },
    });

    return fee;
  });

  return result;
}

export async function deleteOrderFee(feeId: string) {
  const fee = await prisma.orderFee.findUniqueOrThrow({ where: { id: feeId } });

  await prisma.orderFee.delete({ where: { id: feeId } });

  return { deleted: feeId, feeType: fee.feeType };
}
