import { z } from 'zod';

// ========== 售后类型 & 状态字面量 ==========

const afterSalesTypes = ['REFUND', 'RETURN_REFUND', 'EXCHANGE', 'COMPLAINT', 'REPAIR', 'RESEND'] as const;
const afterSalesStatuses = ['PENDING', 'PROCESSING', 'COMPLETED', 'REJECTED'] as const;

const logisticsStages = ['FIRST_MILE', 'DOMESTIC_WAREHOUSE', 'INTERNATIONAL', 'LAST_MILE', 'OVERSEAS_WAREHOUSE'] as const;
const logisticsStatuses = ['PENDING', 'IN_TRANSIT', 'DELIVERED', 'EXCEPTION', 'RETURNED'] as const;

// ========== 售后工单 ==========

export const afterSalesCreateSchema = z.object({
  orderId: z.string().uuid('订单ID格式无效'),
  type: z.enum(afterSalesTypes, { errorMap: () => ({ message: '售后类型无效，可选: REFUND / RETURN_REFUND / EXCHANGE / COMPLAINT / REPAIR / RESEND' }) }),
  reason: z.string().min(1, '售后原因不能为空'),
  refundAmount: z.number().min(0, '退款金额不能为负').optional(),
  logisticsFee: z.number().min(0, '物流费用不能为负').optional(),
  compensation: z.number().min(0, '赔偿金不能为负').optional(),
  lossAmount: z.number().min(0, '货损金额不能为负').optional(),
  resolution: z.string().optional(),
});

export const afterSalesUpdateSchema = z.object({
  status: z.enum(afterSalesStatuses, { errorMap: () => ({ message: '售后状态无效，可选: PENDING / PROCESSING / COMPLETED / REJECTED' }) }).optional(),
  reason: z.string().optional(),
  resolution: z.string().optional(),
  refundAmount: z.number().min(0, '退款金额不能为负').optional(),
  logisticsFee: z.number().min(0, '物流费用不能为负').optional(),
  compensation: z.number().min(0, '赔偿金不能为负').optional(),
  lossAmount: z.number().min(0, '货损金额不能为负').optional(),
});

// ========== 物流 ==========

export const logisticsCreateSchema = z.object({
  orderId: z.string().uuid('订单ID格式无效'),
  trackingNumber: z.string().optional(),
  carrier: z.string().optional(),
  channel: z.string().optional(),
  stage: z.enum(logisticsStages, { errorMap: () => ({ message: '物流阶段无效，可选: FIRST_MILE / DOMESTIC_WAREHOUSE / INTERNATIONAL / LAST_MILE / OVERSEAS_WAREHOUSE' }) }).default('FIRST_MILE'),
  firstMileFee: z.number().min(0, '头程费用不能为负').optional(),
  internationalFee: z.number().min(0, '国际运输费用不能为负').optional(),
  lastMileFee: z.number().min(0, '尾程费用不能为负').optional(),
  estimatedDelivery: z.string().refine((s) => !isNaN(Date.parse(s)), '预计送达日期格式无效').optional(),
  exceptionNote: z.string().optional(),
});

export const logisticsUpdateSchema = z.object({
  status: z.enum(logisticsStatuses, { errorMap: () => ({ message: '物流状态无效，可选: PENDING / IN_TRANSIT / DELIVERED / EXCEPTION / RETURNED' }) }).optional(),
  trackingNumber: z.string().optional(),
  carrier: z.string().optional(),
  channel: z.string().optional(),
  stage: z.enum(logisticsStages).optional(),
  firstMileFee: z.number().min(0).optional(),
  internationalFee: z.number().min(0).optional(),
  lastMileFee: z.number().min(0).optional(),
  estimatedDelivery: z.string().refine((s) => !isNaN(Date.parse(s)), '预计送达日期格式无效').optional(),
  actualDelivery: z.string().refine((s) => !isNaN(Date.parse(s)), '实际送达日期格式无效').optional(),
  exceptionNote: z.string().optional(),
});

// ========== 查询 ==========

export const afterSalesQuerySchema = z.object({
  status: z.enum(afterSalesStatuses).optional(),
  type: z.enum(afterSalesTypes).optional(),
  orderId: z.string().uuid().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  page: z.coerce.number().int().positive('页码必须大于0').default(1),
  pageSize: z.coerce.number().int().positive('每页条数必须大于0').max(100, '每页最多100条').default(20),
});

export const logisticsQuerySchema = z.object({
  status: z.enum(logisticsStatuses).optional(),
  carrier: z.string().optional(),
  stage: z.enum(logisticsStages).optional(),
  orderId: z.string().uuid().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  page: z.coerce.number().int().positive('页码必须大于0').default(1),
  pageSize: z.coerce.number().int().positive('每页条数必须大于0').max(100, '每页最多100条').default(20),
});
