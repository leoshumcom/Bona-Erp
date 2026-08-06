import { z } from 'zod';

// ========== 订单 ==========

export const orderCreateSchema = z.object({
  storeId: z.string().uuid('店铺ID格式无效'),
  platformOrderId: z.string().optional(),
  customerName: z.string().optional(),
  customerEmail: z.string().email('邮箱格式无效').optional(),
  country: z.string().default('CN'),
  currency: z.string().default('CNY'),
  // 订单明细（至少一个商品行）
  items: z.array(z.object({
    productId: z.string().uuid('产品ID格式无效'),
    quantity: z.number().int().positive('数量必须为正整数'),
    unitPrice: z.number().positive('单价必须大于0'),
  })).min(1, '至少需要一个订单商品'),
  orderedAt: z.string().refine((s) => !isNaN(Date.parse(s)), '下单日期格式无效'),
  internalNote: z.string().optional(),
  warehouseId: z.string().uuid('仓库ID格式无效').optional(),
});

export const orderQuerySchema = z.object({
  storeId: z.string().uuid().optional(),
  productId: z.string().uuid().optional(),
  status: z.string().optional(),
  paymentStatus: z.string().optional(),
  shippingStatus: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  keyword: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
});

export const orderImportSchema = z.object({
  orders: z.array(orderCreateSchema).min(1, '至少需要导入一条订单'),
});

// ========== 订单费用 ==========

export const orderFeeSchema = z.object({
  orderId: z.string().uuid('订单ID格式无效'),
  feeType: z.enum(['platform_commission', 'advertising', 'logistics', 'aftersales', 'other'], {
    errorMap: () => ({ message: '费用类型必须是 platform_commission/advertising/logistics/aftersales/other' }),
  }),
  amount: z.number().positive('费用金额必须大于0'),
  notes: z.string().optional(),
});

export const feeDeleteSchema = z.object({
  id: z.string().uuid('费用ID格式无效'),
});

// ========== 广告活动 ==========

export const adCampaignSchema = z.object({
  storeId: z.string().uuid('店铺ID格式无效'),
  campaignName: z.string().min(1, '活动名称不能为空'),
  platformCampaignId: z.string().optional(),
  campaignType: z.enum(['sp', 'sd', 'sa', 'info_feed', 'external'], {
    errorMap: () => ({ message: '广告类型必须是 sp/sd/sa/info_feed/external' }),
  }),
  spend: z.number().min(0).default(0),
  startDate: z.string().refine((s) => !isNaN(Date.parse(s)), '开始日期格式无效'),
  endDate: z.string().refine((s) => !isNaN(Date.parse(s)), '结束日期格式无效').optional(),
  impressions: z.number().int().min(0).optional(),
  clicks: z.number().int().min(0).optional(),
  orders: z.number().int().min(0).default(0),
  sales: z.number().min(0).default(0),
});

export const adUpdateSchema = z.object({
  campaignName: z.string().min(1).optional(),
  campaignType: z.enum(['sp', 'sd', 'sa', 'info_feed', 'external']).optional(),
  spend: z.number().min(0).optional(),
  startDate: z.string().refine((s) => !isNaN(Date.parse(s)), '日期格式无效').optional(),
  endDate: z.string().refine((s) => !isNaN(Date.parse(s)), '日期格式无效').optional(),
  impressions: z.number().int().min(0).optional(),
  clicks: z.number().int().min(0).optional(),
  orders: z.number().int().min(0).optional(),
  sales: z.number().min(0).optional(),
});

export const adQuerySchema = z.object({
  storeId: z.string().uuid().optional(),
  campaignType: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
});

export const adSpendQuerySchema = z.object({
  storeId: z.string().uuid().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

// ========== 利润核算 ==========

export const profitCalculateSchema = z.object({
  orderId: z.string().uuid('订单ID格式无效'),
});

export const profitQuerySchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  storeId: z.string().uuid().optional(),
  productId: z.string().uuid().optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
});

export const profitSummaryQuerySchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

export const profitStoreQuerySchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

export const profitProductQuerySchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});
