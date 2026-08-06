import { z } from 'zod';

// ========== 入库 ==========

export const inboundProductionSchema = z.object({
  productionOrderId: z.string().uuid('生产工单ID格式无效'),
  productId: z.string().uuid('产品ID格式无效'),
  quantity: z.number().positive('入库数量必须大于0'),
  unitOfMeasureId: z.string().uuid('单位ID格式无效'),
  storageLocationId: z.string().uuid('库位ID格式无效'),
  unitCost: z.number().positive('单位成本必须大于0'),
  notes: z.string().optional(),
});

export const inboundPurchaseSchema = z.object({
  productId: z.string().uuid('产品ID格式无效'),
  quantity: z.number().positive('入库数量必须大于0'),
  unitOfMeasureId: z.string().uuid('单位ID格式无效'),
  storageLocationId: z.string().uuid('库位ID格式无效'),
  unitCost: z.number().positive('单位成本必须大于0'),
  supplierId: z.string().uuid('供应商ID格式无效').optional(),
  purchaseOrderId: z.string().optional(),
  notes: z.string().optional(),
});

export const inboundReturnSchema = z.object({
  productId: z.string().uuid('产品ID格式无效'),
  quantity: z.number().positive('入库数量必须大于0'),
  unitOfMeasureId: z.string().uuid('单位ID格式无效'),
  storageLocationId: z.string().uuid('库位ID格式无效'),
  afterSalesId: z.string().uuid('售后工单ID格式无效'),
  unitCost: z.number().positive('单位成本必须大于0'),
  notes: z.string().optional(),
});

export const inboundInitialSchema = z.object({
  productId: z.string().uuid('产品ID格式无效'),
  quantity: z.number().positive('数量必须大于0'),
  unitOfMeasureId: z.string().uuid('单位ID格式无效'),
  storageLocationId: z.string().uuid('库位ID格式无效'),
  unitCost: z.number().positive('单位成本必须大于0'),
  supplierId: z.string().uuid('供应商ID格式无效').optional(),
  notes: z.string().optional(),
});

// ========== 出库 ==========

export const outboundIssueSchema = z.object({
  productionOrderComponentId: z.string().uuid('生产工单组件ID格式无效'),
  productId: z.string().uuid('产品ID格式无效'),
  quantity: z.number().positive('出库数量必须大于0'),
  unitOfMeasureId: z.string().uuid('单位ID格式无效'),
  storageLocationId: z.string().uuid('库位ID格式无效'),
  notes: z.string().optional(),
});

export const outboundShipmentSchema = z.object({
  productId: z.string().uuid('产品ID格式无效'),
  quantity: z.number().positive('出库数量必须大于0'),
  unitOfMeasureId: z.string().uuid('单位ID格式无效'),
  storageLocationId: z.string().uuid('库位ID格式无效'),
  orderId: z.string().uuid('订单ID格式无效'),
  notes: z.string().optional(),
});

export const outboundReturnStockSchema = z.object({
  productId: z.string().uuid('产品ID格式无效'),
  quantity: z.number().positive('退料数量必须大于0'),
  unitOfMeasureId: z.string().uuid('单位ID格式无效'),
  storageLocationId: z.string().uuid('库位ID格式无效'),
  notes: z.string().optional(),
});

// ========== 盘点 ==========

export const countPlanSchema = z.object({
  warehouseId: z.string().uuid('仓库ID格式无效'),
  planDate: z.string().refine((s) => !isNaN(Date.parse(s)), '盘点日期格式无效'),
  notes: z.string().optional(),
});

export const countItemSchema = z.object({
  countPlanId: z.string().uuid('盘点计划ID格式无效'),
  productId: z.string().uuid('产品ID格式无效'),
  storageLocationId: z.string().uuid('库位ID格式无效'),
  systemQuantity: z.number(),
  actualQuantity: z.number(),
  unitOfMeasureId: z.string().uuid('单位ID格式无效'),
});

export const countAdjustSchema = z.object({
  countPlanId: z.string().uuid('盘点计划ID格式无效'),
  adjustments: z.array(z.object({
    productId: z.string().uuid('产品ID格式无效'),
    storageLocationId: z.string().uuid('库位ID格式无效'),
    difference: z.number(), // 正=盘盈, 负=盘亏
    unitOfMeasureId: z.string().uuid('单位ID格式无效'),
    reason: z.string().optional(),
  })),
});

// ========== 查询 ==========

export const ledgerQuerySchema = z.object({
  productId: z.string().uuid().optional(),
  storageLocationId: z.string().uuid().optional(),
  movementType: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
});

export const lotQuerySchema = z.object({
  productId: z.string().uuid().optional(),
  storageLocationId: z.string().uuid().optional(),
  supplierId: z.string().uuid().optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
});

export const balanceQuerySchema = z.object({
  productId: z.string().uuid().optional(),
  storageLocationId: z.string().uuid().optional(),
  warehouseId: z.string().uuid().optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
});
