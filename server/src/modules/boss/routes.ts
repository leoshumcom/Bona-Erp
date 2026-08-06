import { Router, Response } from 'express';
import { authMiddleware, requireRole, AuthRequest } from '../../common/middleware';
import { success, error } from '../../common/response';
import * as dashboardService from './services/dashboardService';
import * as s from './schemas';

const router = Router();

// 所有老板看板操作需要认证 + BOSS/ADMIN 角色
router.use(authMiddleware);
router.use(requireRole('ADMIN', 'BOSS'));

/** 统一处理校验错误 */
function getValidationErrors(result: { success: false; error: any }) {
  return result.error.issues?.map((i: any) => `${i.path.join('.')}: ${i.message}`).join('; ');
}

/** 统一错误响应 */
function handleError(res: Response, err: any, defaultMsg: string) {
  console.error('Boss dashboard error:', err);
  return res.status(500).json(error(err.message || defaultMsg, 500));
}

// ============================================================
// GET /dashboard/snapshot - 每日经营快照
// ============================================================
router.get('/dashboard/snapshot', async (req: AuthRequest, res: Response) => {
  try {
    const parsed = s.dateQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json(error(getValidationErrors(parsed), 400));
    }
    const result = await dashboardService.getDailySnapshot(parsed.data.date);
    res.json(success(result, '查询成功'));
  } catch (err: any) { handleError(res, err, '查询快照失败'); }
});

// ============================================================
// GET /dashboard/revenue-trend - 收入趋势
// ============================================================
router.get('/dashboard/revenue-trend', async (req: AuthRequest, res: Response) => {
  try {
    const parsed = s.periodQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json(error(getValidationErrors(parsed), 400));
    }
    const result = await dashboardService.getRevenueTrend(parsed.data.period as '7d' | '30d' | '12m');
    res.json(success(result, '查询成功'));
  } catch (err: any) { handleError(res, err, '查询收入趋势失败'); }
});

// ============================================================
// GET /dashboard/stores - 店铺业绩
// ============================================================
router.get('/dashboard/stores', async (req: AuthRequest, res: Response) => {
  try {
    const parsed = s.dateRangeQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json(error(getValidationErrors(parsed), 400));
    }
    const result = await dashboardService.getStorePerformance(parsed.data.startDate, parsed.data.endDate);
    res.json(success(result, '查询成功'));
  } catch (err: any) { handleError(res, err, '查询店铺业绩失败'); }
});

// ============================================================
// GET /dashboard/products - 产品盈利能力
// ============================================================
router.get('/dashboard/products', async (req: AuthRequest, res: Response) => {
  try {
    const parsed = s.dateRangeQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json(error(getValidationErrors(parsed), 400));
    }
    const result = await dashboardService.getProductProfitability(parsed.data.startDate, parsed.data.endDate);
    res.json(success(result, '查询成功'));
  } catch (err: any) { handleError(res, err, '查询产品盈利能力失败'); }
});

// ============================================================
// GET /dashboard/cost-structure - 成本结构
// ============================================================
router.get('/dashboard/cost-structure', async (req: AuthRequest, res: Response) => {
  try {
    const parsed = s.dateRangeQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json(error(getValidationErrors(parsed), 400));
    }
    const result = await dashboardService.getCostStructure(parsed.data.startDate, parsed.data.endDate);
    res.json(success(result, '查询成功'));
  } catch (err: any) { handleError(res, err, '查询成本结构失败'); }
});

// ============================================================
// GET /dashboard/alerts - 业务预警
// ============================================================
router.get('/dashboard/alerts', async (_req: AuthRequest, res: Response) => {
  try {
    const result = await dashboardService.getAlerts();
    res.json(success(result, '查询成功'));
  } catch (err: any) { handleError(res, err, '查询预警失败'); }
});

// ============================================================
// GET /dashboard/kpi - KPI指标卡片
// ============================================================
router.get('/dashboard/kpi', async (_req: AuthRequest, res: Response) => {
  try {
    const result = await dashboardService.getKPIOverview();
    res.json(success(result, '查询成功'));
  } catch (err: any) { handleError(res, err, '查询KPI指标失败'); }
});

export default router;
