import { Prisma } from '@prisma/client';
import { prisma } from '../../../common/prisma';
import { computeFIFOAllocation, FIFOInsufficientError, type LotLike, type FIFOAllocation } from './fifo';

// ============================================================
// 工具函数
// ============================================================

/** 生成批次号: LOT-{type}-{date}-{seq} */
function generateLotNumber(prefix: string): string {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const seq = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `LOT-${prefix}-${date}-${seq}`;
}

/**
 * 更新库存余额（在事务内调用）
 */
async function upsertBalance(
  tx: Prisma.TransactionClient,
  params: {
    productId: string;
    storageLocationId: string;
    quantityDelta: number;
    costDelta: number;
    unitOfMeasureId: string;
  },
) {
  const { productId, storageLocationId, quantityDelta, costDelta, unitOfMeasureId } = params;

  const existing = await tx.inventoryBalance.findUnique({
    where: { productId_storageLocationId: { productId, storageLocationId } },
  });

  if (existing) {
    return tx.inventoryBalance.update({
      where: { id: existing.id },
      data: {
        quantityOnHand: existing.quantityOnHand + quantityDelta,
        totalCost: existing.totalCost + costDelta,
        lastMovementAt: new Date(),
      },
    });
  }

  return tx.inventoryBalance.create({
    data: {
      productId,
      storageLocationId,
      quantityOnHand: quantityDelta,
      totalCost: costDelta,
      unitOfMeasureId,
      lastMovementAt: new Date(),
    },
  });
}

/**
 * 创建库存账本记录（在事务内调用）
 */
function createLedger(
  tx: Prisma.TransactionClient,
  params: {
    movementType: string;
    productId: string;
    storageLocationId: string;
    quantity: number;
    unitOfMeasureId: string;
    unitCost?: number;
    referenceType: string;
    referenceId: string;
    postedById: string;
    notes?: string;
  },
) {
  return tx.inventoryLedger.create({
    data: {
      movementType: params.movementType as any,
      productId: params.productId,
      storageLocationId: params.storageLocationId,
      quantity: params.quantity,
      unitOfMeasureId: params.unitOfMeasureId,
      unitCost: params.unitCost != null ? params.unitCost : null,
      referenceType: params.referenceType,
      referenceId: params.referenceId,
      postedById: params.postedById,
      notes: params.notes,
    },
  });
}

/**
 * 写入审计日志（在事务内调用）
 */
function writeAuditLog(
  tx: Prisma.TransactionClient,
  params: {
    entityType: string;
    entityId: string;
    action: string;
    actorId: string;
    beforeState?: Record<string, unknown>;
    afterState?: Record<string, unknown>;
  },
) {
  return tx.auditLog.create({
    data: {
      entityType: params.entityType,
      entityId: params.entityId,
      action: params.action,
      actorId: params.actorId,
      beforeState: params.beforeState != null ? JSON.stringify(params.beforeState) : undefined,
      afterState: params.afterState != null ? JSON.stringify(params.afterState) : undefined,
    },
  });
}

/**
 * FIFO 选择批次：从 DB 查询后委托纯函数计算分配
 */
async function selectFIFOLots(
  tx: Prisma.TransactionClient,
  productId: string,
  storageLocationId: string,
  neededQuantity: number,
) {
  // 先从原材料批次查找
  const materialLots = await tx.materialLot.findMany({
    where: {
      productId,
      storageLocationId,
      quantityRemaining: { gt: 0 },
    },
    orderBy: { receivedAt: 'asc' },
  });

  if (materialLots.length > 0) {
    return computeFIFOAllocation(materialLots as unknown as LotLike[], neededQuantity);
  }

  // 再从成品批次查找
  const finishedLots = await tx.finishedGoodLot.findMany({
    where: {
      productId,
      storageLocationId,
      quantity: { gt: 0 },
    },
    orderBy: { receivedAt: 'asc' },
  });

  // 成品批次用quantity而非quantityRemaining，转换字段名
  const mappedLots = finishedLots.map(l => ({
    id: l.id,
    quantityRemaining: l.quantity,
    unitCost: 0, // 成品成本由财务模块计算
    receivedAt: l.receivedAt,
  }));

  return computeFIFOAllocation(mappedLots, neededQuantity);
}

/**
 * 出库前余额预检：确保有足够库存
 */
async function checkBalance(
  tx: Prisma.TransactionClient,
  productId: string,
  storageLocationId: string,
  neededQty: number,
) {
  const balance = await tx.inventoryBalance.findUnique({
    where: { productId_storageLocationId: { productId, storageLocationId } },
  });

  if (!balance || balance.quantityOnHand < neededQty) {
    const onHand = balance?.quantityOnHand.toString() ?? '0';
    throw new InsufficientStockError(
      productId,
      storageLocationId,
      neededQty.toString(),
      onHand,
    );
  }
}

/**
 * 库存不足错误
 */
export class InsufficientStockError extends Error {
  constructor(
    public readonly productId: string,
    public readonly storageLocationId: string,
    public readonly needed: string,
    public readonly onHand: string,
  ) {
    super(`库存不足: 需要 ${needed}, 当前库存 ${onHand}`);
    this.name = 'InsufficientStockError';
  }
}

/**
 * 批量扣减 FIFO 批次（在事务内调用）
 * 使用 allocation 结果批量更新 lot + 创建消耗记录
 */
async function batchDeductLots(
  tx: Prisma.TransactionClient,
  operatorId: string,
  allocation: FIFOAllocation[],
  productionOrderComponentId?: string,
  notes?: string,
) {
  const lotIds = allocation.map((a) => a.lotId);

  // 先查原材料批次
  let lotsMap = new Map(
    (await tx.materialLot.findMany({ where: { id: { in: lotIds } } })).map((l) => [l.id, l]),
  );
  
  let isFinishedGood = false;
  
  // 如果没找到，查成品批次
  if (lotsMap.size === 0) {
    isFinishedGood = true;
    lotsMap = new Map(
      (await tx.finishedGoodLot.findMany({ where: { id: { in: lotIds } } })).map((l) => [l.id, l]),
    );
  }

  let totalCostConsumed = 0;
  const consumptions: Array<{ lotId: string; consumeQuantity: string; unitCost: string }> = [];

  for (const alloc of allocation) {
    const lot = lotsMap.get(alloc.lotId);
    if (!lot) throw new Error(`批次 ${alloc.lotId} 不存在`);

    // 更新批次剩余数量
    const newRemaining = (lot as any).quantityRemaining ?? (lot as any).quantity - alloc.consumeQuantity;
    if (isFinishedGood) {
      await (tx as any).finishedGoodLot.update({
        where: { id: alloc.lotId },
        data: { quantity: newRemaining },
      });
    } else {
      await tx.materialLot.update({
        where: { id: alloc.lotId },
        data: { quantityRemaining: newRemaining },
      });
    }

    // 记录消耗
    if (productionOrderComponentId && !isFinishedGood) {
      await tx.materialLotConsumption.create({
        data: {
          productionOrderComponentId,
          materialLotId: alloc.lotId,
          quantity: alloc.consumeQuantity,
          postedById: operatorId,
          notes,
        },
      });
    }

    consumptions.push({
      lotId: alloc.lotId,
      consumeQuantity: alloc.consumeQuantity.toString(),
      unitCost: alloc.unitCost.toString(),
    });
    totalCostConsumed = totalCostConsumed + alloc.consumeQuantity * alloc.unitCost;
  }

  return { consumptions, totalCostConsumed };
}

/**
 * 执行完整的出库事务：余额预检 → FIFO分配 → 批次扣减 → 账本 → 余额更新 → 审计
 */
async function executeOutbound(
  tx: Prisma.TransactionClient,
  operatorId: string,
  params: {
    movementType: string;
    productId: string;
    storageLocationId: string;
    quantity: number;
    unitOfMeasureId: string;
    referenceType: string;
    referenceId: string;
    productionOrderComponentId?: string;   // 生产领料时传入
    notes?: string;
  },
) {
  const qty = params.quantity;

  // 1. 余额预检
  await checkBalance(tx, params.productId, params.storageLocationId, qty);

  // 2. FIFO 分配
  const allocation = await selectFIFOLots(
    tx,
    params.productId,
    params.storageLocationId,
    qty,
  );

  // 3. 批量扣减批次
  const { consumptions, totalCostConsumed } = await batchDeductLots(
    tx,
    operatorId,
    allocation,
    params.productionOrderComponentId,
    params.notes,
  );

  // 4. 创建库存账本（负数）
  const ledger = await createLedger(tx, {
    movementType: params.movementType,
    productId: params.productId,
    storageLocationId: params.storageLocationId,
    quantity: -params.quantity,
    unitOfMeasureId: params.unitOfMeasureId,
    referenceType: params.referenceType,
    referenceId: params.referenceId,
    postedById: operatorId,
    notes: params.notes,
  });

  // 5. 更新库存余额
  const balance = await upsertBalance(tx, {
    productId: params.productId,
    storageLocationId: params.storageLocationId,
    quantityDelta: -qty,
    costDelta: -totalCostConsumed,
    unitOfMeasureId: params.unitOfMeasureId,
  });

  // 6. 审计日志
  await writeAuditLog(tx, {
    entityType: 'InventoryLedger',
    entityId: ledger.id,
    action: params.movementType,
    actorId: operatorId,
    afterState: {
      movementType: params.movementType,
      productId: params.productId,
      quantity: -params.quantity,
      totalCost: totalCostConsumed.toString(),
      referenceType: params.referenceType,
      referenceId: params.referenceId,
      fifoBatches: allocation.length,
    },
  });

  return {
    ledger,
    balance,
    allocation: consumptions,
    fifoBatches: allocation.length,
    totalCost: totalCostConsumed.toString(),
  };
}

// ============================================================
// 一、入库操作
// ============================================================

/** 生产入库 - 生产工单完成的成品入库 */
export async function inboundProduction(
  operatorId: string,
  params: {
    productionOrderId: string;
    productId: string;
    quantity: number;
    unitOfMeasureId: string;
    storageLocationId: string;
    unitCost: number;
    notes?: string;
  },
) {
  // D1: sequential (no interactive tx)
  // 1. 验证生产工单存在
  const po = await prisma.productionOrder.findUniqueOrThrow({
    where: { id: params.productionOrderId },
  });

  // 2. 生成成品批次
  const lotNumber = generateLotNumber('FG');
  const lot = await prisma.finishedGoodLot.create({
    data: {
      lotNumber,
      productId: params.productId,
      productionOrderId: params.productionOrderId,
      quantity: params.quantity,
      unitOfMeasureId: params.unitOfMeasureId,
      storageLocationId: params.storageLocationId,
    },
  });

  // 3. 创建库存账本记录
  const ledger = await createLedger(prisma, {
    movementType: 'GOODS_RECEIPT',
    productId: params.productId,
    storageLocationId: params.storageLocationId,
    quantity: params.quantity,
    unitOfMeasureId: params.unitOfMeasureId,
    unitCost: params.unitCost,
    referenceType: 'ProductionOrder',
    referenceId: params.productionOrderId,
    postedById: operatorId,
    notes: params.notes,
  });

  // 4. 更新库存余额
  const costTotal = params.quantity * params.unitCost;
  const balance = await upsertBalance(prisma, {
    productId: params.productId,
    storageLocationId: params.storageLocationId,
    quantityDelta: params.quantity,
    costDelta: costTotal,
    unitOfMeasureId: params.unitOfMeasureId,
  });

  // 5. 更新工单完工数量
  await prisma.productionOrder.update({
    where: { id: params.productionOrderId },
    data: {
      completedQuantity: po.completedQuantity + params.quantity,
    },
  });

  return { lot, ledger, balance };
}

/** 采购入库 */
export async function inboundPurchase(
  operatorId: string,
  params: {
    productId: string;
    quantity: number;
    unitOfMeasureId: string;
    storageLocationId: string;
    unitCost: number;
    supplierId?: string;
    purchaseOrderId?: string;
    notes?: string;
  },
) {
  // D1: sequential (no interactive tx)
  // 1. 生成物料批次
  const lotNumber = generateLotNumber('PO');
  const lot = await prisma.materialLot.create({
    data: {
      lotNumber,
      productId: params.productId,
      quantityReceived: params.quantity,
      quantityRemaining: params.quantity,
      unitOfMeasureId: params.unitOfMeasureId,
      unitCost: params.unitCost,
      storageLocationId: params.storageLocationId,
      sourceType: params.purchaseOrderId ? 'PurchaseOrder' : 'InitialStock',
      sourceRefId: params.purchaseOrderId || '',
      supplierId: params.supplierId,
      receivedAt: new Date(),
    },
  });

  // 2. 创建库存账本
  const refId = params.purchaseOrderId || '';
  const ledger = await createLedger(prisma, {
    movementType: 'PURCHASE_RECEIPT',
    productId: params.productId,
    storageLocationId: params.storageLocationId,
    quantity: params.quantity,
    unitOfMeasureId: params.unitOfMeasureId,
    unitCost: params.unitCost,
    referenceType: params.purchaseOrderId ? 'PurchaseOrder' : 'Manual',
    referenceId: refId || `MANUAL-${Date.now()}`,
    postedById: operatorId,
    notes: params.notes,
  });

  // 3. 更新库存余额
  const costTotal = params.quantity * params.unitCost;
  const balance = await upsertBalance(prisma, {
    productId: params.productId,
    storageLocationId: params.storageLocationId,
    quantityDelta: params.quantity,
    costDelta: costTotal,
    unitOfMeasureId: params.unitOfMeasureId,
  });

  return { lot, ledger, balance };
}

/** 售后退货入库 */
export async function inboundReturn(
  operatorId: string,
  params: {
    productId: string;
    quantity: number;
    unitOfMeasureId: string;
    storageLocationId: string;
    afterSalesId: string;
    unitCost: number;
    notes?: string;
  },
) {
  // D1: sequential (no interactive tx)
  const lotNumber = generateLotNumber('AR');
  const lot = await prisma.materialLot.create({
    data: {
      lotNumber,
      productId: params.productId,
      quantityReceived: params.quantity,
      quantityRemaining: params.quantity,
      unitOfMeasureId: params.unitOfMeasureId,
      unitCost: params.unitCost,
      storageLocationId: params.storageLocationId,
      sourceType: 'AfterSales',
      sourceRefId: params.afterSalesId,
      receivedAt: new Date(),
    },
  });

  const ledger = await createLedger(prisma, {
    movementType: 'AFTERSALES_RETURN',
    productId: params.productId,
    storageLocationId: params.storageLocationId,
    quantity: params.quantity,
    unitOfMeasureId: params.unitOfMeasureId,
    unitCost: params.unitCost,
    referenceType: 'AfterSales',
    referenceId: params.afterSalesId,
    postedById: operatorId,
    notes: params.notes,
  });

  const costTotal = params.quantity * params.unitCost;
  const balance = await upsertBalance(prisma, {
    productId: params.productId,
    storageLocationId: params.storageLocationId,
    quantityDelta: params.quantity,
    costDelta: costTotal,
    unitOfMeasureId: params.unitOfMeasureId,
  });

  return { lot, ledger, balance };
}

/** 期初库存导入 */
export async function inboundInitial(
  operatorId: string,
  params: {
    productId: string;
    quantity: number;
    unitOfMeasureId: string;
    storageLocationId: string;
    unitCost: number;
    supplierId?: string;
    notes?: string;
  },
) {
  // D1: sequential (no interactive tx)
  const lotNumber = generateLotNumber('INIT');
  const lot = await prisma.materialLot.create({
    data: {
      lotNumber,
      productId: params.productId,
      quantityReceived: params.quantity,
      quantityRemaining: params.quantity,
      unitOfMeasureId: params.unitOfMeasureId,
      unitCost: params.unitCost,
      storageLocationId: params.storageLocationId,
      sourceType: 'InitialStock',
      sourceRefId: `INIT-${Date.now()}`,
      supplierId: params.supplierId,
      receivedAt: new Date(),
    },
  });

  const ledger = await createLedger(prisma, {
    movementType: 'INITIAL',
    productId: params.productId,
    storageLocationId: params.storageLocationId,
    quantity: params.quantity,
    unitOfMeasureId: params.unitOfMeasureId,
    unitCost: params.unitCost,
    referenceType: 'System',
    referenceId: `INIT-${Date.now()}`,
    postedById: operatorId,
    notes: params.notes || '期初库存导入',
  });

  const costTotal = params.quantity * params.unitCost;
  const balance = await upsertBalance(prisma, {
    productId: params.productId,
    storageLocationId: params.storageLocationId,
    quantityDelta: params.quantity,
    costDelta: costTotal,
    unitOfMeasureId: params.unitOfMeasureId,
  });

  return { lot, ledger, balance };
}

// ============================================================
// 二、出库操作（事务整合+余额预检+审计+业务联动）
// ============================================================

/**
 * 生产领料 - FIFO批次扣减
 *
 * 事务流程:
 *   余额预检 → FIFO分配 → 批量批次扣减 → 消耗记录 →
 *   库存账本(负) → 余额更新 → 审计日志 → 更新工单组件已领量
 */
export async function outboundIssue(
  operatorId: string,
  params: {
    productionOrderComponentId: string;
    productId: string;
    quantity: number;
    unitOfMeasureId: string;
    storageLocationId: string;
    notes?: string;
  },
) {
  // D1: sequential (no interactive tx)
  // 验证工单组件存在
  const component = await prisma.productionOrderComponent.findUniqueOrThrow({
    where: { id: params.productionOrderComponentId },
  });

  // 记录审计前快照
  const beforeBalance = await prisma.inventoryBalance.findUnique({
    where: {
      productId_storageLocationId: {
        productId: params.productId,
        storageLocationId: params.storageLocationId,
      },
    },
  });

  // 执行标准出库流程
  const outbound = await executeOutbound(prisma, operatorId, {
    movementType: 'MATERIAL_ISSUE',
    productId: params.productId,
    storageLocationId: params.storageLocationId,
    quantity: params.quantity,
    unitOfMeasureId: params.unitOfMeasureId,
    referenceType: 'ProductionOrder',
    referenceId: params.productionOrderComponentId,
    productionOrderComponentId: params.productionOrderComponentId,
    notes: params.notes,
  });

  // 业务联动: 更新工单组件已领数量
  await prisma.productionOrderComponent.update({
    where: { id: params.productionOrderComponentId },
    data: {
      issuedQuantity: component.issuedQuantity + params.quantity,
    },
  });

  // 补充库存变更前后快照到审计
  await writeAuditLog(prisma, {
    entityType: 'InventoryBalance',
    entityId: outbound.balance.id,
    action: 'MATERIAL_ISSUE_BALANCE',
    actorId: operatorId,
    beforeState: beforeBalance
      ? { quantityOnHand: beforeBalance.quantityOnHand.toString(), totalCost: beforeBalance.totalCost.toString() }
      : undefined,
    afterState: {
      quantityOnHand: outbound.balance.quantityOnHand.toString(),
      totalCost: outbound.balance.totalCost.toString(),
    },
  });

  return {
    ...outbound,
    action: 'MATERIAL_ISSUE',
    componentId: params.productionOrderComponentId,
    issuedQuantity: (component.issuedQuantity + params.quantity).toString(),
  };
}

/**
 * 销售出库 - FIFO
 *
 * 事务流程:
 *   余额预检 → FIFO分配 → 批量批次扣减 →
 *   库存账本(负) → 余额更新 → 审计日志 → 更新订单发货状态
 */
export async function outboundShipment(
  operatorId: string,
  params: {
    productId: string;
    quantity: number;
    unitOfMeasureId: string;
    storageLocationId: string;
    orderId: string;
    notes?: string;
  },
) {
  // D1: sequential (no interactive tx)
  // 验证订单存在
  const order = await prisma.order.findUniqueOrThrow({
    where: { id: params.orderId },
  });

  // 记录售前余额
  const beforeBalance = await prisma.inventoryBalance.findUnique({
    where: {
      productId_storageLocationId: {
        productId: params.productId,
        storageLocationId: params.storageLocationId,
      },
    },
  });

  // 执行标准出库流程
  const outbound = await executeOutbound(prisma, operatorId, {
    movementType: 'SHIPMENT',
    productId: params.productId,
    storageLocationId: params.storageLocationId,
    quantity: params.quantity,
    unitOfMeasureId: params.unitOfMeasureId,
    referenceType: 'Order',
    referenceId: params.orderId,
    notes: params.notes || `订单 ${order.orderNumber} 销售出库`,
  });

  // 业务联动: 更新订单发货状态
  await prisma.order.update({
    where: { id: params.orderId },
    data: {
      shippingStatus: 'SHIPPED',
      shippedAt: new Date(),
    },
  });

  // 补充库存变更审计
  await writeAuditLog(prisma, {
    entityType: 'InventoryBalance',
    entityId: outbound.balance.id,
    action: 'SHIPMENT_BALANCE',
    actorId: operatorId,
    beforeState: beforeBalance
      ? { quantityOnHand: beforeBalance.quantityOnHand.toString(), totalCost: beforeBalance.totalCost.toString() }
      : undefined,
    afterState: {
      quantityOnHand: outbound.balance.quantityOnHand.toString(),
      totalCost: outbound.balance.totalCost.toString(),
    },
  });

  return {
    ...outbound,
    action: 'SHIPMENT',
    orderId: params.orderId,
    orderNumber: order.orderNumber,
  };
}

/**
 * 退料 - 生产领料后退回
 *
 * 事务流程:
 *   追溯原始领料成本 → 生成退料批次 → 库存账本(正) →
 *   余额更新 → 审计日志
 */
export async function outboundReturnStock(
  operatorId: string,
  params: {
    productId: string;
    quantity: number;
    unitOfMeasureId: string;
    storageLocationId: string;
    productionOrderComponentId?: string;
    notes?: string;
  },
) {
  // D1: sequential (no interactive tx)
  // 1. 追溯原始领料成本: 查询最近一次 MATERIAL_ISSUE 的平均成本
  const recentIssue = await prisma.inventoryLedger.findFirst({
    where: {
      productId: params.productId,
      storageLocationId: params.storageLocationId,
      movementType: 'MATERIAL_ISSUE',
    },
    orderBy: { postedAt: 'desc' },
    select: { unitCost: true },
  });

  const unitCost = recentIssue?.unitCost ?? 0;
  const costTotal = unitCost * params.quantity;

  // 记录返库前余额
  const beforeBalance = await prisma.inventoryBalance.findUnique({
    where: {
      productId_storageLocationId: {
        productId: params.productId,
        storageLocationId: params.storageLocationId,
      },
    },
  });

  // 2. 生成退料批次
  const lotNumber = generateLotNumber('RET');
  const lot = await prisma.materialLot.create({
    data: {
      lotNumber,
      productId: params.productId,
      quantityReceived: params.quantity,
      quantityRemaining: params.quantity,
      unitOfMeasureId: params.unitOfMeasureId,
      unitCost,
      storageLocationId: params.storageLocationId,
      sourceType: 'ProductionOrder',
      sourceRefId: params.productionOrderComponentId || `RETURN-${Date.now()}`,
      receivedAt: new Date(),
      notes: params.notes || '生产退料',
    },
  });

  // 3. 创建库存账本（正数）
  const ledger = await createLedger(prisma, {
    movementType: 'RETURN_TO_STOCK',
    productId: params.productId,
    storageLocationId: params.storageLocationId,
    quantity: params.quantity,
    unitOfMeasureId: params.unitOfMeasureId,
    unitCost: Number(unitCost),
    referenceType: 'ProductionOrder',
    referenceId: params.productionOrderComponentId || `RETURN-${Date.now()}`,
    postedById: operatorId,
    notes: params.notes || '生产退料',
  });

  // 4. 更新库存余额
  const balance = await upsertBalance(prisma, {
    productId: params.productId,
    storageLocationId: params.storageLocationId,
    quantityDelta: params.quantity,
    costDelta: costTotal,
    unitOfMeasureId: params.unitOfMeasureId,
  });

  // 5. 审计日志
  await writeAuditLog(prisma, {
    entityType: 'InventoryLedger',
    entityId: ledger.id,
    action: 'RETURN_TO_STOCK',
    actorId: operatorId,
    afterState: {
      productId: params.productId,
      quantity: params.quantity,
      unitCost: unitCost.toString(),
      totalCost: costTotal.toString(),
      lotNumber,
    },
  });

  await writeAuditLog(prisma, {
    entityType: 'InventoryBalance',
    entityId: balance.id,
    action: 'RETURN_TO_STOCK_BALANCE',
    actorId: operatorId,
    beforeState: beforeBalance
      ? { quantityOnHand: beforeBalance.quantityOnHand.toString(), totalCost: beforeBalance.totalCost.toString() }
      : undefined,
    afterState: {
      quantityOnHand: balance.quantityOnHand.toString(),
      totalCost: balance.totalCost.toString(),
    },
  });

  return { lot, ledger, balance, tracedCost: unitCost.toString() };
}

// ============================================================
// 三、盘点操作
// ============================================================

/** 创建盘点计划 */
export async function createCountPlan(
  operatorId: string,
  params: {
    warehouseId: string;
    planDate: string;
    notes?: string;
  },
) {
  // 盘点计划以 JSON 方式存储并返回，后续可建独立 CountPlan 表
  // 注意：不再写入 inventoryLedger 表（该表依赖 productId/storageLocationId/unitOfMeasureId 外键）
  return {
    id: `COUNT-${Date.now().toString(36).toUpperCase()}`,
    type: 'COUNT_PLAN',
    warehouseId: params.warehouseId,
    planDate: params.planDate,
    notes: params.notes || null,
    createdBy: operatorId,
    createdAt: new Date().toISOString(),
  };
}

/** 执行盘点差异调整 */
export async function executeCountAdjust(
  operatorId: string,
  params: {
    countPlanId: string;
    adjustments: Array<{
      productId: string;
      storageLocationId: string;
      difference: number;        // 正=盘盈, 负=盘亏
      unitOfMeasureId: string;
      reason?: string;
    }>;
  },
) {
  const results: Array<{
    productId: string;
    difference: number;
    ledger: any;
    balance: any;
  }> = [];

  for (const adj of params.adjustments) {
    // D1: sequential (no interactive tx)
    const ledger = await createLedger(prisma, {
      movementType: 'ADJUSTMENT',
      productId: adj.productId,
      storageLocationId: adj.storageLocationId,
      quantity: adj.difference,
      unitOfMeasureId: adj.unitOfMeasureId,
      referenceType: 'CountPlan',
      referenceId: params.countPlanId,
      postedById: operatorId,
      notes: adj.reason || '盘点调整',
    });

    const balance = await upsertBalance(prisma, {
      productId: adj.productId,
      storageLocationId: adj.storageLocationId,
      quantityDelta: adj.difference,
      costDelta: 0, // 盘点调整不改成本
      unitOfMeasureId: adj.unitOfMeasureId,
    });

    const r = { productId: adj.productId, difference: adj.difference, ledger, balance };

    results.push(r);
  }

  return { adjustedCount: results.length, results };
}

// ============================================================
// 四、查询操作
// ============================================================

/** 库存余额查询 */
export async function getBalances(filters: {
  productId?: string;
  storageLocationId?: string;
  warehouseId?: string;
  page: number;
  pageSize: number;
}) {
  const where: any = {};

  if (filters.productId) where.productId = filters.productId;
  if (filters.storageLocationId) where.storageLocationId = filters.storageLocationId;
  if (filters.warehouseId) {
    where.storageLocation = { warehouseId: filters.warehouseId };
  }

  const [data, total] = await Promise.all([
    prisma.inventoryBalance.findMany({
      where,
      include: {
        product: { select: { id: true, sku: true, name: true } },
        storageLocation: { select: { id: true, code: true, warehouseId: true } },
        unitOfMeasure: { select: { id: true, code: true, description: true } },
      },
      skip: (filters.page - 1) * filters.pageSize,
      take: filters.pageSize,
      orderBy: { updatedAt: 'desc' },
    }),
    prisma.inventoryBalance.count({ where }),
  ]);

  return { data, total, page: filters.page, pageSize: filters.pageSize };
}

/** 库存流水查询 */
export async function getLedger(filters: {
  productId?: string;
  storageLocationId?: string;
  movementType?: string;
  startDate?: string;
  endDate?: string;
  page: number;
  pageSize: number;
}) {
  const where: any = {};

  if (filters.productId) where.productId = filters.productId;
  if (filters.storageLocationId) where.storageLocationId = filters.storageLocationId;
  if (filters.movementType) where.movementType = filters.movementType;
  if (filters.startDate || filters.endDate) {
    where.postedAt = {};
    if (filters.startDate) where.postedAt.gte = new Date(filters.startDate);
    if (filters.endDate) where.postedAt.lte = new Date(filters.endDate);
  }

  const [data, total] = await Promise.all([
    prisma.inventoryLedger.findMany({
      where,
      include: {
        product: { select: { id: true, sku: true, name: true } },
        storageLocation: { select: { id: true, code: true } },
        unitOfMeasure: { select: { id: true, code: true } },
        postedBy: { select: { id: true, realName: true } },
      },
      skip: (filters.page - 1) * filters.pageSize,
      take: filters.pageSize,
      orderBy: { postedAt: 'desc' },
    }),
    prisma.inventoryLedger.count({ where }),
  ]);

  return { data, total, page: filters.page, pageSize: filters.pageSize };
}

/** 批次查询 */
export async function getLots(filters: {
  productId?: string;
  storageLocationId?: string;
  supplierId?: string;
  page: number;
  pageSize: number;
}) {
  const where: any = {};

  if (filters.productId) where.productId = filters.productId;
  if (filters.storageLocationId) where.storageLocationId = filters.storageLocationId;
  if (filters.supplierId) where.supplierId = filters.supplierId;

  const [data, total] = await Promise.all([
    prisma.materialLot.findMany({
      where,
      include: {
        product: { select: { id: true, sku: true, name: true } },
        storageLocation: { select: { id: true, code: true } },
        supplier: { select: { id: true, name: true } },
      },
      skip: (filters.page - 1) * filters.pageSize,
      take: filters.pageSize,
      orderBy: { receivedAt: 'desc' },
    }),
    prisma.materialLot.count({ where }),
  ]);

  return { data, total, page: filters.page, pageSize: filters.pageSize };
}

/** 库存快照 - 按仓库汇总 */
export async function getWarehouseSummary(warehouseId?: string) {
  const where = warehouseId
    ? { storageLocation: { warehouseId } }
    : {};

  const balances = await prisma.inventoryBalance.findMany({
    where,
    include: {
      product: { select: { id: true, sku: true, name: true, materialType: true } },
      storageLocation: {
        select: { id: true, code: true, warehouse: { select: { id: true, code: true, name: true } } },
      },
      unitOfMeasure: { select: { id: true, code: true } },
    },
  });

  // 按仓库分组汇总
  const warehouseMap = new Map<string, {
    warehouseId: string;
    warehouseCode: string;
    warehouseName: string;
    totalProducts: number;
    totalQuantity: number;
    totalCost: number;
  }>();

  for (const b of balances) {
    const w = b.storageLocation.warehouse;
    if (!warehouseMap.has(w.id)) {
      warehouseMap.set(w.id, {
        warehouseId: w.id,
        warehouseCode: w.code,
        warehouseName: w.name,
        totalProducts: 0,
        totalQuantity: 0,
        totalCost: 0,
      });
    }
    const entry = warehouseMap.get(w.id)!;
    entry.totalProducts += 1;
    entry.totalQuantity += Number(b.quantityOnHand);
    entry.totalCost += Number(b.totalCost);
  }

  return Array.from(warehouseMap.values());
}
