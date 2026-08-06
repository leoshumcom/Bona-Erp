import { PrismaClient, Prisma } from '@prisma/client';
import { computeFIFOAllocation, computeFIFOTotalCost, type LotLike } from './fifo';

const prisma = new PrismaClient();

// ============================================================
// 工具函数
// ============================================================

/** 生成批次号: LOT-{type}-{date}-{seq} */
function generateLotNumber(prefix: string): string {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const seq = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `LOT-${prefix}-${date}-${seq}`;
}

/** 生成流水号 */
function generateLedgerNo(): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const seq = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `IVT${timestamp}${seq}`;
}

/**
 * 更新库存余额（在事务内调用）
 * 对指定 product + storageLocation 进行 quantity 和 totalCost 的增减
 */
async function upsertBalance(
  tx: Prisma.TransactionClient,
  params: {
    productId: string;
    storageLocationId: string;
    quantityDelta: Prisma.Decimal;   // 正=增加 负=减少
    costDelta: Prisma.Decimal;       // 总成本变化量
    unitOfMeasureId: string;
  },
) {
  const { productId, storageLocationId, quantityDelta, costDelta, unitOfMeasureId } = params;

  const existing = await tx.inventoryBalance.findUnique({
    where: {
      productId_storageLocationId: { productId, storageLocationId },
    },
  });

  if (existing) {
    return tx.inventoryBalance.update({
      where: { id: existing.id },
      data: {
        quantityOnHand: Prisma.Decimal.add(existing.quantityOnHand, quantityDelta),
        totalCost: Prisma.Decimal.add(existing.totalCost, costDelta),
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
    quantity: number;           // 正=入库 负=出库
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
      quantity: new Prisma.Decimal(params.quantity),
      unitOfMeasureId: params.unitOfMeasureId,
      unitCost: params.unitCost != null ? new Prisma.Decimal(params.unitCost) : null,
      referenceType: params.referenceType,
      referenceId: params.referenceId,
      postedById: params.postedById,
      notes: params.notes,
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
  neededQuantity: Prisma.Decimal,
) {
  const lots = await tx.materialLot.findMany({
    where: {
      productId,
      storageLocationId,
      quantityRemaining: { gt: 0 },
    },
    orderBy: { receivedAt: 'asc' },
  });

  return computeFIFOAllocation(lots as unknown as LotLike[], neededQuantity);
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
  const result = await prisma.$transaction(async (tx) => {
    // 1. 验证生产工单存在
    const po = await tx.productionOrder.findUniqueOrThrow({
      where: { id: params.productionOrderId },
    });

    // 2. 生成成品批次
    const lotNumber = generateLotNumber('FG');
    const lot = await tx.finishedGoodLot.create({
      data: {
        lotNumber,
        productId: params.productId,
        productionOrderId: params.productionOrderId,
        quantity: new Prisma.Decimal(params.quantity),
        unitOfMeasureId: params.unitOfMeasureId,
        storageLocationId: params.storageLocationId,
      },
    });

    // 3. 创建库存账本记录
    const ledger = await createLedger(tx, {
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
    const costTotal = new Prisma.Decimal(params.quantity).mul(params.unitCost);
    const balance = await upsertBalance(tx, {
      productId: params.productId,
      storageLocationId: params.storageLocationId,
      quantityDelta: new Prisma.Decimal(params.quantity),
      costDelta: costTotal,
      unitOfMeasureId: params.unitOfMeasureId,
    });

    // 5. 更新工单完工数量
    await tx.productionOrder.update({
      where: { id: params.productionOrderId },
      data: {
        completedQuantity: Prisma.Decimal.add(po.completedQuantity, params.quantity),
      },
    });

    return { lot, ledger, balance };
  });

  return result;
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
  const result = await prisma.$transaction(async (tx) => {
    // 1. 生成物料批次
    const lotNumber = generateLotNumber('PO');
    const lot = await tx.materialLot.create({
      data: {
        lotNumber,
        productId: params.productId,
        quantityReceived: new Prisma.Decimal(params.quantity),
        quantityRemaining: new Prisma.Decimal(params.quantity),
        unitOfMeasureId: params.unitOfMeasureId,
        unitCost: new Prisma.Decimal(params.unitCost),
        storageLocationId: params.storageLocationId,
        sourceType: params.purchaseOrderId ? 'PurchaseOrder' : 'InitialStock',
        sourceRefId: params.purchaseOrderId || '',
        supplierId: params.supplierId,
        receivedAt: new Date(),
      },
    });

    // 2. 创建库存账本
    const refId = params.purchaseOrderId || '';
    const ledger = await createLedger(tx, {
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
    const costTotal = new Prisma.Decimal(params.quantity).mul(params.unitCost);
    const balance = await upsertBalance(tx, {
      productId: params.productId,
      storageLocationId: params.storageLocationId,
      quantityDelta: new Prisma.Decimal(params.quantity),
      costDelta: costTotal,
      unitOfMeasureId: params.unitOfMeasureId,
    });

    return { lot, ledger, balance };
  });

  return result;
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
  const result = await prisma.$transaction(async (tx) => {
    const lotNumber = generateLotNumber('AR');
    const lot = await tx.materialLot.create({
      data: {
        lotNumber,
        productId: params.productId,
        quantityReceived: new Prisma.Decimal(params.quantity),
        quantityRemaining: new Prisma.Decimal(params.quantity),
        unitOfMeasureId: params.unitOfMeasureId,
        unitCost: new Prisma.Decimal(params.unitCost),
        storageLocationId: params.storageLocationId,
        sourceType: 'AfterSales',
        sourceRefId: params.afterSalesId,
        receivedAt: new Date(),
      },
    });

    const ledger = await createLedger(tx, {
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

    const costTotal = new Prisma.Decimal(params.quantity).mul(params.unitCost);
    const balance = await upsertBalance(tx, {
      productId: params.productId,
      storageLocationId: params.storageLocationId,
      quantityDelta: new Prisma.Decimal(params.quantity),
      costDelta: costTotal,
      unitOfMeasureId: params.unitOfMeasureId,
    });

    return { lot, ledger, balance };
  });

  return result;
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
  const result = await prisma.$transaction(async (tx) => {
    const lotNumber = generateLotNumber('INIT');
    const lot = await tx.materialLot.create({
      data: {
        lotNumber,
        productId: params.productId,
        quantityReceived: new Prisma.Decimal(params.quantity),
        quantityRemaining: new Prisma.Decimal(params.quantity),
        unitOfMeasureId: params.unitOfMeasureId,
        unitCost: new Prisma.Decimal(params.unitCost),
        storageLocationId: params.storageLocationId,
        sourceType: 'InitialStock',
        sourceRefId: `INIT-${Date.now()}`,
        supplierId: params.supplierId,
        receivedAt: new Date(),
      },
    });

    const ledger = await createLedger(tx, {
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

    const costTotal = new Prisma.Decimal(params.quantity).mul(params.unitCost);
    const balance = await upsertBalance(tx, {
      productId: params.productId,
      storageLocationId: params.storageLocationId,
      quantityDelta: new Prisma.Decimal(params.quantity),
      costDelta: costTotal,
      unitOfMeasureId: params.unitOfMeasureId,
    });

    return { lot, ledger, balance };
  });

  return result;
}

// ============================================================
// 二、出库操作
// ============================================================

/** 生产领料 - FIFO批次扣减 */
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
  const result = await prisma.$transaction(async (tx) => {
    const qty = new Prisma.Decimal(params.quantity);

    // 1. FIFO 选择批次
    const selectedLots = await selectFIFOLots(
      tx,
      params.productId,
      params.storageLocationId,
      qty,
    );

    // 2. 扣减每个批次的剩余数量，记录消耗
    const consumptions: Array<{ lotId: string; consumeQuantity: string }> = [];
    let totalCostConsumed = new Prisma.Decimal(0);

    for (const sel of selectedLots) {
      await tx.materialLot.update({
        where: { id: sel.lotId },
        data: {
          quantityRemaining: Prisma.Decimal.sub(
            (await tx.materialLot.findUniqueOrThrow({ where: { id: sel.lotId } })).quantityRemaining,
            sel.consumeQuantity,
          ),
        },
      });

      await tx.materialLotConsumption.create({
        data: {
          productionOrderComponentId: params.productionOrderComponentId,
          materialLotId: sel.lotId,
          quantity: sel.consumeQuantity,
          postedById: operatorId,
          notes: params.notes,
        },
      });

      consumptions.push({ lotId: sel.lotId, consumeQuantity: sel.consumeQuantity.toString() });
      totalCostConsumed = Prisma.Decimal.add(
        totalCostConsumed,
        Prisma.Decimal.mul(sel.consumeQuantity, sel.unitCost),
      );
    }

    // 3. 创建库存账本（负数）
    const ledger = await createLedger(tx, {
      movementType: 'MATERIAL_ISSUE',
      productId: params.productId,
      storageLocationId: params.storageLocationId,
      quantity: -params.quantity,
      unitOfMeasureId: params.unitOfMeasureId,
      referenceType: 'ProductionOrder',
      referenceId: params.productionOrderComponentId,
      postedById: operatorId,
      notes: params.notes,
    });

    // 4. 更新库存余额
    const balance = await upsertBalance(tx, {
      productId: params.productId,
      storageLocationId: params.storageLocationId,
      quantityDelta: qty.negated(),
      costDelta: totalCostConsumed.negated(),
      unitOfMeasureId: params.unitOfMeasureId,
    });

    return { ledger, balance, consumptions, fifoBatches: selectedLots.length };
  });

  return result;
}

/** 销售出库 - FIFO */
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
  const result = await prisma.$transaction(async (tx) => {
    const qty = new Prisma.Decimal(params.quantity);

    // 1. FIFO 扣减
    const selectedLots = await selectFIFOLots(
      tx,
      params.productId,
      params.storageLocationId,
      qty,
    );

    let totalCost = new Prisma.Decimal(0);
    for (const sel of selectedLots) {
      await tx.materialLot.update({
        where: { id: sel.lotId },
        data: {
          quantityRemaining: Prisma.Decimal.sub(
            (await tx.materialLot.findUniqueOrThrow({ where: { id: sel.lotId } })).quantityRemaining,
            sel.consumeQuantity,
          ),
        },
      });
      totalCost = Prisma.Decimal.add(totalCost, Prisma.Decimal.mul(sel.consumeQuantity, sel.unitCost));
    }

    // 2. 创建库存账本
    const ledger = await createLedger(tx, {
      movementType: 'SHIPMENT',
      productId: params.productId,
      storageLocationId: params.storageLocationId,
      quantity: -params.quantity,
      unitOfMeasureId: params.unitOfMeasureId,
      referenceType: 'Order',
      referenceId: params.orderId,
      postedById: operatorId,
      notes: params.notes,
    });

    const balance = await upsertBalance(tx, {
      productId: params.productId,
      storageLocationId: params.storageLocationId,
      quantityDelta: qty.negated(),
      costDelta: totalCost.negated(),
      unitOfMeasureId: params.unitOfMeasureId,
    });

    return { ledger, balance, totalCost: totalCost.toString() };
  });

  return result;
}

/** 退料 - 生产领料后退回 */
export async function outboundReturnStock(
  operatorId: string,
  params: {
    productId: string;
    quantity: number;
    unitOfMeasureId: string;
    storageLocationId: string;
    notes?: string;
  },
) {
  const result = await prisma.$transaction(async (tx) => {
    const ledger = await createLedger(tx, {
      movementType: 'RETURN_TO_STOCK',
      productId: params.productId,
      storageLocationId: params.storageLocationId,
      quantity: params.quantity,
      unitOfMeasureId: params.unitOfMeasureId,
      referenceType: 'ProductionOrder',
      referenceId: `RETURN-${Date.now()}`,
      postedById: operatorId,
      notes: params.notes || '生产退料',
    });

    const balance = await upsertBalance(tx, {
      productId: params.productId,
      storageLocationId: params.storageLocationId,
      quantityDelta: new Prisma.Decimal(params.quantity),
      costDelta: new Prisma.Decimal(0), // 退料成本需从原始领料中查找，这里简化处理
      unitOfMeasureId: params.unitOfMeasureId,
    });

    return { ledger, balance };
  });

  return result;
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
  // 盘点计划暂时以 JSON 方式存储，后续可建独立表
  // 此处创建为一条日志记录，关联仓库
  return prisma.inventoryLedger.create({
    data: {
      movementType: 'ADJUSTMENT',
      productId: '00000000-0000-0000-0000-000000000000', // 占位
      storageLocationId: '00000000-0000-0000-0000-000000000000',
      quantity: new Prisma.Decimal(0),
      unitOfMeasureId: '00000000-0000-0000-0000-000000000000',
      referenceType: 'CountPlan',
      referenceId: `COUNT-${Date.now()}`,
      postedById: operatorId,
      notes: JSON.stringify({
        type: 'COUNT_PLAN',
        warehouseId: params.warehouseId,
        planDate: params.planDate,
        notes: params.notes,
      }),
    },
  });
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
    const r = await prisma.$transaction(async (tx) => {
      const ledger = await createLedger(tx, {
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

      const balance = await upsertBalance(tx, {
        productId: adj.productId,
        storageLocationId: adj.storageLocationId,
        quantityDelta: new Prisma.Decimal(adj.difference),
        costDelta: new Prisma.Decimal(0), // 盘点调整不改成本
        unitOfMeasureId: adj.unitOfMeasureId,
      });

      return { productId: adj.productId, difference: adj.difference, ledger, balance };
    });

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
