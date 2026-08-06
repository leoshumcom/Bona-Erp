// @ts-nocheck
import { Hono } from 'hono';
import * as aftersalesService from './services/aftersalesService';
import * as logisticsService from './services/logisticsService';

export const aftersalesRoutes = new Hono();

const SYSTEM_USER = 'system';

function handlePrismaError(err: any) {
  if (err.code === 'P2025') return { status: 404, message: '关联的业务记录不存在' };
  if (err.code === 'P2002') return { status: 409, message: '数据冲突，唯一字段重复' };
  return { status: 500, message: err.message || '服务器错误' };
}

// ============================================================
// 售后工单
// ============================================================

aftersalesRoutes.post('/', async (c) => {
  try {
    const body = await c.req.json();
    const result = await aftersalesService.createAfterSales(SYSTEM_USER, body);
    return c.json(result);
  } catch (err: any) {
    const e = handlePrismaError(err);
    c.status(e.status); return c.json({ error: e.message });
  }
});

aftersalesRoutes.get('/', async (c) => {
  try {
    const page = parseInt(c.req.query('page') || '1');
    const pageSize = parseInt(c.req.query('pageSize') || '20');
    const result = await aftersalesService.getAfterSalesList({
      status: c.req.query('status'),
      type: c.req.query('type'),
      orderId: c.req.query('orderId'),
      startDate: c.req.query('startDate'),
      endDate: c.req.query('endDate'),
      page,
      pageSize,
    });
    return c.json(result);
  } catch (err: any) {
    const e = handlePrismaError(err);
    c.status(e.status); return c.json({ error: e.message });
  }
});

aftersalesRoutes.get('/:id', async (c) => {
  try {
    const result = await aftersalesService.getAfterSalesDetail(c.req.param('id'));
    return c.json(result);
  } catch (err: any) {
    const e = handlePrismaError(err);
    c.status(e.status); return c.json({ error: e.message });
  }
});

aftersalesRoutes.patch('/:id/status', async (c) => {
  try {
    const body = await c.req.json();
    const result = await aftersalesService.updateAfterSalesStatus(c.req.param('id'), body.status, SYSTEM_USER);
    return c.json(result);
  } catch (err: any) {
    const e = handlePrismaError(err);
    c.status(e.status); return c.json({ error: e.message });
  }
});

// ============================================================
// 物流管理
// ============================================================

aftersalesRoutes.post('/logistics', async (c) => {
  try {
    const body = await c.req.json();
    const result = await logisticsService.createLogistics(SYSTEM_USER, body);
    return c.json(result);
  } catch (err: any) {
    const e = handlePrismaError(err);
    c.status(e.status); return c.json({ error: e.message });
  }
});

aftersalesRoutes.get('/logistics', async (c) => {
  try {
    const page = parseInt(c.req.query('page') || '1');
    const pageSize = parseInt(c.req.query('pageSize') || '20');
    const result = await logisticsService.getLogisticsList({
      status: c.req.query('status'),
      carrier: c.req.query('carrier'),
      stage: c.req.query('stage'),
      orderId: c.req.query('orderId'),
      startDate: c.req.query('startDate'),
      endDate: c.req.query('endDate'),
      page,
      pageSize,
    });
    return c.json(result);
  } catch (err: any) {
    const e = handlePrismaError(err);
    c.status(e.status); return c.json({ error: e.message });
  }
});

// IMPORTANT: track route must be defined before :id to avoid conflict
aftersalesRoutes.get('/logistics/track/:trackingNumber', async (c) => {
  try {
    const result = await logisticsService.trackLogistics(c.req.param('trackingNumber'));
    return c.json(result);
  } catch (err: any) {
    const e = handlePrismaError(err);
    c.status(e.status); return c.json({ error: e.message });
  }
});

aftersalesRoutes.get('/logistics/cost-summary', async (c) => {
  try {
    const result = await logisticsService.getShippingCostSummary(
      c.req.query('startDate'),
      c.req.query('endDate'),
    );
    return c.json(result);
  } catch (err: any) {
    const e = handlePrismaError(err);
    c.status(e.status); return c.json({ error: e.message });
  }
});

aftersalesRoutes.get('/logistics/:id', async (c) => {
  try {
    const result = await logisticsService.getLogisticsDetail(c.req.param('id'));
    return c.json(result);
  } catch (err: any) {
    const e = handlePrismaError(err);
    c.status(e.status); return c.json({ error: e.message });
  }
});

aftersalesRoutes.patch('/logistics/:id/status', async (c) => {
  try {
    const body = await c.req.json();
    const result = await logisticsService.updateLogisticsStatus(
      c.req.param('id'),
      body.status,
      body.actualDelivery,
    );
    return c.json(result);
  } catch (err: any) {
    const e = handlePrismaError(err);
    c.status(e.status); return c.json({ error: e.message });
  }
});

export default aftersalesRoutes;
