import { Router, Response } from 'express';
import { authMiddleware, requireRole, AuthRequest } from '../../common/middleware';
import { success, error, paginated } from '../../common/response';
import * as s from './schemas';
import * as orderService from './services/orderService';
import * as adService from './services/adService';
import * as profitService from './services/profitService';

const router = Router();

// 所有操作模块路由需要认证
router.use(authMiddleware);

// ============================================================
// 工具函数
// ============================================================

/** 统一处理 Zod 校验错误 */
function getValidationErrors(result: { success: false; error: any }) {
  return result.error.issues?.map((i: any) => `${i.path.join('.')}: ${i.message}`).join('; ');
}

/** 统一错误响应 */
function handleError(res: Response, err: any, defaultMsg: string) {
  if (err.code === 'P2025') {
    return res.status(404).json(error('关联的业务记录不存在，请检查ID是否正确', 404));
  }
  if (err.code === 'P2002') {
    return res.status(409).json(error('数据冲突，订单号或唯一字段重复', 409));
  }
  return res.status(500).json(error(err.message || defaultMsg, 500));
}

// 权限角色定义
const WRITE_ROLES = ['ADMIN', 'OPERATOR', 'BOSS'] as const;
const READ_ROLES = ['ADMIN', 'OPERATOR', 'BOSS', 'VIEWER'] as const;

// ============================================================
// 一、订单管理
// ============================================================

/** POST /api/operation/orders - 创建订单 */
router.post('/orders', requireRole(...WRITE_ROLES), async (req: AuthRequest, res: Response) => {
  try {
    const parsed = s.orderCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json(error(getValidationErrors(parsed), 400));
    }
    const result = await orderService.createOrder(req.userId!, parsed.data);
    res.status(201).json(success(result, '订单创建成功'));
  } catch (err: any) { handleError(res, err, '创建订单失败'); }
});

/** GET /api/operation/orders - 订单列表 */
router.get('/orders', requireRole(...READ_ROLES), async (req: AuthRequest, res: Response) => {
  try {
    const parsed = s.orderQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json(error(getValidationErrors(parsed), 400));
    }
    const result = await orderService.getOrders(parsed.data);
    res.json(paginated(result.data, result.total, result.page, result.pageSize));
  } catch (err: any) { handleError(res, err, '查询订单列表失败'); }
});

/** GET /api/operation/orders/:id - 订单详情 */
router.get('/orders/:id', requireRole(...READ_ROLES), async (req: AuthRequest, res: Response) => {
  try {
    const result = await orderService.getOrderDetail(req.params.id as string);
    res.json(success(result, '查询成功'));
  } catch (err: any) { handleError(res, err, '查询订单详情失败'); }
});

/** POST /api/operation/orders/import - 批量导入订单 */
router.post('/orders/import', requireRole(...WRITE_ROLES), async (req: AuthRequest, res: Response) => {
  try {
    const parsed = s.orderImportSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json(error(getValidationErrors(parsed), 400));
    }
    const result = await orderService.importOrders(req.userId!, parsed.data.orders);
    res.status(201).json(success(result, `导入完成: 成功 ${result.successCount}, 失败 ${result.failCount}`));
  } catch (err: any) { handleError(res, err, '批量导入订单失败'); }
});

// ============================================================
// 二、订单费用管理
// ============================================================

/** POST /api/operation/orders/fees - 添加订单费用 */
router.post('/orders/fees', requireRole(...WRITE_ROLES), async (req: AuthRequest, res: Response) => {
  try {
    const parsed = s.orderFeeSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json(error(getValidationErrors(parsed), 400));
    }
    const result = await orderService.addOrderFee(req.userId!, parsed.data);
    res.status(201).json(success(result, '费用添加成功'));
  } catch (err: any) { handleError(res, err, '添加订单费用失败'); }
});

/** DELETE /api/operation/orders/fees/:id - 删除订单费用 */
router.delete('/orders/fees/:id', requireRole(...WRITE_ROLES), async (req: AuthRequest, res: Response) => {
  try {
    const result = await orderService.deleteOrderFee(req.params.id as string);
    res.json(success(result, '费用已删除'));
  } catch (err: any) { handleError(res, err, '删除订单费用失败'); }
});

// ============================================================
// 三、广告管理
// ============================================================

/** POST /api/operation/ads - 创建广告活动 */
router.post('/ads', requireRole(...WRITE_ROLES), async (req: AuthRequest, res: Response) => {
  try {
    const parsed = s.adCampaignSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json(error(getValidationErrors(parsed), 400));
    }
    const result = await adService.createCampaign(req.userId!, parsed.data);
    res.status(201).json(success(result, '广告活动创建成功'));
  } catch (err: any) { handleError(res, err, '创建广告活动失败'); }
});

/** GET /api/operation/ads - 广告活动列表 */
router.get('/ads', requireRole(...READ_ROLES), async (req: AuthRequest, res: Response) => {
  try {
    const parsed = s.adQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json(error(getValidationErrors(parsed), 400));
    }
    const result = await adService.getCampaigns(parsed.data);
    res.json(paginated(result.data, result.total, result.page, result.pageSize));
  } catch (err: any) { handleError(res, err, '查询广告活动列表失败'); }
});

/** PUT /api/operation/ads/:id - 更新广告活动 */
router.put('/ads/:id', requireRole(...WRITE_ROLES), async (req: AuthRequest, res: Response) => {
  try {
    const parsed = s.adUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json(error(getValidationErrors(parsed), 400));
    }
    const result = await adService.updateCampaign(req.params.id as string, parsed.data);
    res.json(success(result, '广告活动更新成功'));
  } catch (err: any) { handleError(res, err, '更新广告活动失败'); }
});

/** PATCH /api/operation/ads/:id/end - 结束广告活动 */
router.patch('/ads/:id/end', requireRole(...WRITE_ROLES), async (req: AuthRequest, res: Response) => {
  try {
    const result = await adService.endCampaign(req.params.id as string);
    res.json(success(result, '广告活动已结束'));
  } catch (err: any) { handleError(res, err, '结束广告活动失败'); }
});

/** GET /api/operation/ads/spend-summary - 广告花费汇总 */
router.get('/ads/spend-summary', requireRole(...READ_ROLES), async (req: AuthRequest, res: Response) => {
  try {
    const parsed = s.adSpendQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json(error(getValidationErrors(parsed), 400));
    }
    const { storeId, startDate, endDate } = parsed.data;
    const result = await adService.getAdSpendSummary(storeId, startDate, endDate);
    res.json(success(result, '查询成功'));
  } catch (err: any) { handleError(res, err, '查询广告花费汇总失败'); }
});

// ============================================================
// 四、利润核算
// ============================================================

/** POST /api/operation/profit/calculate - 计算订单利润 */
router.post('/profit/calculate', requireRole(...WRITE_ROLES), async (req: AuthRequest, res: Response) => {
  try {
    const parsed = s.profitCalculateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json(error(getValidationErrors(parsed), 400));
    }
    const result = await profitService.calculateOrderProfit(parsed.data.orderId, req.userId!);
    res.json(success(result, '利润核算完成'));
  } catch (err: any) { handleError(res, err, '利润核算失败'); }
});

/** GET /api/operation/profit - 订单利润列表 */
router.get('/profit', requireRole(...READ_ROLES), async (req: AuthRequest, res: Response) => {
  try {
    const parsed = s.profitQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json(error(getValidationErrors(parsed), 400));
    }
    const result = await profitService.getOrderProfitList(parsed.data);
    res.json(paginated(result.data, result.total, result.page, result.pageSize));
  } catch (err: any) { handleError(res, err, '查询利润列表失败'); }
});

/** GET /api/operation/profit/summary - 利润汇总 */
router.get('/profit/summary', requireRole(...READ_ROLES), async (req: AuthRequest, res: Response) => {
  try {
    const parsed = s.profitSummaryQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json(error(getValidationErrors(parsed), 400));
    }
    const result = await profitService.getProfitSummary(parsed.data.startDate, parsed.data.endDate);
    res.json(success(result, '查询成功'));
  } catch (err: any) { handleError(res, err, '查询利润汇总失败'); }
});

/** GET /api/operation/profit/store - 按店铺利润分组 */
router.get('/profit/store', requireRole(...READ_ROLES), async (req: AuthRequest, res: Response) => {
  try {
    const parsed = s.profitStoreQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json(error(getValidationErrors(parsed), 400));
    }
    const result = await profitService.getStoreProfit(parsed.data.startDate, parsed.data.endDate);
    res.json(success(result, '查询成功'));
  } catch (err: any) { handleError(res, err, '查询店铺利润失败'); }
});

/** GET /api/operation/profit/product - 按产品利润分组 */
router.get('/profit/product', requireRole(...READ_ROLES), async (req: AuthRequest, res: Response) => {
  try {
    const parsed = s.profitProductQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json(error(getValidationErrors(parsed), 400));
    }
    const result = await profitService.getProductProfit(parsed.data.startDate, parsed.data.endDate);
    res.json(success(result, '查询成功'));
  } catch (err: any) { handleError(res, err, '查询产品利润失败'); }
});

export default router;
