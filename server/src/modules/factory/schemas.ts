import { z } from 'zod';

// ============================================================
// 模具管理 Schemas
// ============================================================

export const moldCreateSchema = z.object({
  moldCode: z.string().min(1, '模具编号不能为空'),
  productId: z.string().uuid('产品ID格式无效'),
  moldCost: z.number().positive('模具成本必须大于0'),
  lifespan: z.number().int('使用寿命必须为整数').default(0),
  startDate: z.string().refine((s) => !isNaN(Date.parse(s)), '启用日期格式无效'),
  scrapDate: z.string().optional().refine((s) => s == null || !isNaN(Date.parse(s)), '报废日期格式无效'),
  notes: z.string().optional(),
});

export const moldUpdateSchema = z.object({
  moldCode: z.string().min(1, '模具编号不能为空').optional(),
  productId: z.string().uuid('产品ID格式无效').optional(),
  moldCost: z.number().positive('模具成本必须大于0').optional(),
  lifespan: z.number().int('使用寿命必须为整数').optional(),
  startDate: z.string().refine((s) => !isNaN(Date.parse(s)), '启用日期格式无效').optional(),
  scrapDate: z.string().optional().refine((s) => s == null || !isNaN(Date.parse(s)), '报废日期格式无效'),
  status: z.enum(['active', 'maintained', 'scrapped']).optional(),
  notes: z.string().optional(),
});

export const moldExpenseSchema = z.object({
  moldId: z.string().uuid('模具ID格式无效'),
  type: z.string().min(1, '费用类型不能为空'),
  amount: z.number().positive('费用金额必须大于0'),
  expenseDate: z.string().refine((s) => !isNaN(Date.parse(s)), '费用日期格式无效'),
  notes: z.string().optional(),
});

export const moldQuerySchema = z.object({
  status: z.string().optional(),
  productId: z.string().uuid().optional(),
  keyword: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
});

export const moldDepreciationQuerySchema = z.object({
  moldId: z.string().uuid('模具ID格式无效').optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
});

// ============================================================
// BOM 管理 Schemas
// ============================================================

export const bomLineSchema = z.object({
  materialId: z.string().uuid('物料ID格式无效'),
  quantity: z.number().positive('用量必须大于0'),
  unitOfMeasureId: z.string().uuid('单位ID格式无效'),
  scrapPercent: z.number().min(0).max(100).default(0).optional(),
  lineNumber: z.number().int().positive('行号必须为正整数'),
  notes: z.string().optional(),
});

export const bomCreateSchema = z.object({
  productId: z.string().uuid('产品ID格式无效'),
  description: z.string().optional(),
  baseQuantity: z.number().positive('基础生产数量必须大于0').default(1),
  lines: z.array(bomLineSchema).min(1, 'BOM行不能为空'),
});

export const bomQuerySchema = z.object({
  productId: z.string().uuid().optional(),
  status: z.string().optional(),
  keyword: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
});

// ============================================================
// 生产工单 Schemas
// ============================================================

export const productionOrderCreateSchema = z.object({
  productId: z.string().uuid('产品ID格式无效'),
  bomId: z.string().uuid('BOM ID格式无效'),
  quantity: z.number().positive('生产数量必须大于0'),
  unitOfMeasureId: z.string().uuid('单位ID格式无效'),
  plannedStartDate: z.string().refine((s) => !isNaN(Date.parse(s)), '计划开始日期格式无效').optional(),
  plannedEndDate: z.string().refine((s) => !isNaN(Date.parse(s)), '计划结束日期格式无效').optional(),
  notes: z.string().optional(),
});

export const productionOrderQuerySchema = z.object({
  status: z.string().optional(),
  productId: z.string().uuid().optional(),
  keyword: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
});

export const productionCostSchema = z.object({
  productionOrderId: z.string().uuid('生产工单ID格式无效'),
  costType: z.string().min(1, '成本类型不能为空'),
  amount: z.number().positive('金额必须大于0'),
  notes: z.string().optional(),
});

// ============================================================
// 工厂固定费用 Schemas
// ============================================================

export const factoryExpenseSchema = z.object({
  expenseType: z.string().min(1, '费用类型不能为空'),
  amount: z.number().positive('金额必须大于0'),
  expenseMonth: z.string().regex(/^\d{4}-\d{2}$/, '费用月份格式必须为YYYY-MM'),
  notes: z.string().optional(),
});

// ============================================================
// 成本查询 Schemas
// ============================================================

export const costBreakdownQuerySchema = z.object({
  productId: z.string().uuid('产品ID格式无效'),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

export const factoryOverheadQuerySchema = z.object({
  period: z.string().regex(/^\d{4}-\d{2}$/, '费用月份格式必须为YYYY-MM'),
});
