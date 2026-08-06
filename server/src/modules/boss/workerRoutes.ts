// @ts-nocheck
import { Hono } from 'hono';
import * as dashboardService from './services/dashboardService';

export const bossRoutes = new Hono();

function handleError(err: any) {
  console.error('Boss dashboard error:', err);
  return { status: 500, message: err.message || '服务器错误' };
}

// ============================================================
// GET /dashboard/snapshot - 每日经营快照
// ============================================================
bossRoutes.get('/dashboard/snapshot', async (c) => {
  try {
    const result = await dashboardService.getDailySnapshot(c.req.query('date'));
    return c.json(result);
  } catch (err: any) {
    const e = handleError(err);
    c.status(e.status); return c.json({ error: e.message });
  }
});

// ============================================================
// GET /dashboard/revenue-trend - 收入趋势
// ============================================================
bossRoutes.get('/dashboard/revenue-trend', async (c) => {
  try {
    const period = (c.req.query('period') || '7d') as '7d' | '30d' | '12m';
    const result = await dashboardService.getRevenueTrend(period);
    return c.json(result);
  } catch (err: any) {
    const e = handleError(err);
    c.status(e.status); return c.json({ error: e.message });
  }
});

// ============================================================
// GET /dashboard/stores - 店铺业绩
// ============================================================
bossRoutes.get('/dashboard/stores', async (c) => {
  try {
    const result = await dashboardService.getStorePerformance(
      c.req.query('startDate'),
      c.req.query('endDate'),
    );
    return c.json(result);
  } catch (err: any) {
    const e = handleError(err);
    c.status(e.status); return c.json({ error: e.message });
  }
});

// ============================================================
// GET /dashboard/products - 产品盈利能力
// ============================================================
bossRoutes.get('/dashboard/products', async (c) => {
  try {
    const result = await dashboardService.getProductProfitability(
      c.req.query('startDate'),
      c.req.query('endDate'),
    );
    return c.json(result);
  } catch (err: any) {
    const e = handleError(err);
    c.status(e.status); return c.json({ error: e.message });
  }
});

// ============================================================
// GET /dashboard/cost-structure - 成本结构
// ============================================================
bossRoutes.get('/dashboard/cost-structure', async (c) => {
  try {
    const result = await dashboardService.getCostStructure(
      c.req.query('startDate'),
      c.req.query('endDate'),
    );
    return c.json(result);
  } catch (err: any) {
    const e = handleError(err);
    c.status(e.status); return c.json({ error: e.message });
  }
});

// ============================================================
// GET /dashboard/alerts - 业务预警
// ============================================================
bossRoutes.get('/dashboard/alerts', async (c) => {
  try {
    const result = await dashboardService.getAlerts();
    return c.json(result);
  } catch (err: any) {
    const e = handleError(err);
    c.status(e.status); return c.json({ error: e.message });
  }
});

// ============================================================
// GET /dashboard/kpi - KPI指标卡片
// ============================================================
bossRoutes.get('/dashboard/kpi', async (c) => {
  try {
    const result = await dashboardService.getKPIOverview();
    return c.json(result);
  } catch (err: any) {
    const e = handleError(err);
    c.status(e.status); return c.json({ error: e.message });
  }
});

export default bossRoutes;
