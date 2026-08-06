import { Router, Response } from 'express';
import { authMiddleware, requireRole, AuthRequest } from '../../common/middleware';
import { success, error } from '../../common/response';
import * as dashboardService from './services/dashboardService';

const router = Router();

// 所有老板看板操作需要认证 + BOSS/ADMIN 角色
router.use(authMiddleware);
router.use(requireRole('ADMIN', 'BOSS'));

// ============================================================
// GET /dashboard/snapshot - 每日经营快照
// ============================================================
router.get('/dashboard/snapshot', async (req: AuthRequest, res: Response) => {
  try {
    const dateStr = req.query.date as string | undefined;
    const result = await dashboardService.getDailySnapshot(dateStr);
    res.json(success(result, '查询成功'));
  } catch (err: any) {
    res.status(500).json(error(err.message || '查询快照失败', 500));
  }
});

// ============================================================
// GET /dashboard/revenue-trend - 收入趋势
// ============================================================
router.get('/dashboard/revenue-trend', async (req: AuthRequest, res: Response) => {
  try {
    const period = (req.query.period as string) || '7d';
    if (!['7d', '30d', '12m'].includes(period)) {
      return res.status(400).json(error('参数 period 必须为 7d、30d 或 12m', 400));
    }
    const result = await dashboardService.getRevenueTrend(period as '7d' | '30d' | '12m');
    res.json(success(result, '查询成功'));
  } catch (err: any) {
    res.status(500).json(error(err.message || '查询收入趋势失败', 500));
  }
});

// ============================================================
// GET /dashboard/stores - 店铺业绩
// ============================================================
router.get('/dashboard/stores', async (req: AuthRequest, res: Response) => {
  try {
    const startDate = req.query.startDate as string | undefined;
    const endDate = req.query.endDate as string | undefined;
    const result = await dashboardService.getStorePerformance(startDate, endDate);
    res.json(success(result, '查询成功'));
  } catch (err: any) {
    res.status(500).json(error(err.message || '查询店铺业绩失败', 500));
  }
});

// ============================================================
// GET /dashboard/products - 产品盈利能力
// ============================================================
router.get('/dashboard/products', async (req: AuthRequest, res: Response) => {
  try {
    const startDate = req.query.startDate as string | undefined;
    const endDate = req.query.endDate as string | undefined;
    const result = await dashboardService.getProductProfitability(startDate, endDate);
    res.json(success(result, '查询成功'));
  } catch (err: any) {
    res.status(500).json(error(err.message || '查询产品盈利能力失败', 500));
  }
});

// ============================================================
// GET /dashboard/cost-structure - 成本结构
// ============================================================
router.get('/dashboard/cost-structure', async (req: AuthRequest, res: Response) => {
  try {
    const startDate = req.query.startDate as string | undefined;
    const endDate = req.query.endDate as string | undefined;
    const result = await dashboardService.getCostStructure(startDate, endDate);
    res.json(success(result, '查询成功'));
  } catch (err: any) {
    res.status(500).json(error(err.message || '查询成本结构失败', 500));
  }
});

// ============================================================
// GET /dashboard/alerts - 业务预警
// ============================================================
router.get('/dashboard/alerts', async (_req: AuthRequest, res: Response) => {
  try {
    const result = await dashboardService.getAlerts();
    res.json(success(result, '查询成功'));
  } catch (err: any) {
    res.status(500).json(error(err.message || '查询预警失败', 500));
  }
});

// ============================================================
// GET /dashboard/kpi - KPI指标卡片
// ============================================================
router.get('/dashboard/kpi', async (_req: AuthRequest, res: Response) => {
  try {
    const result = await dashboardService.getKPIOverview();
    res.json(success(result, '查询成功'));
  } catch (err: any) {
    res.status(500).json(error(err.message || '查询KPI指标失败', 500));
  }
});

export default router;
