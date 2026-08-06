// @ts-nocheck
import { Hono } from 'hono';
import * as orderService from './services/orderService';
import * as adService from './services/adService';
import * as profitService from './services/profitService';

export const operationRoutes = new Hono();

const SYSTEM_USER = 'system';

function handlePrismaError(err: any) {
  if (err.code === 'P2025') return { status: 404, message: '关联的业务记录不存在' };
  if (err.code === 'P2002') return { status: 409, message: '数据冲突，唯一字段重复' };
  return { status: 500, message: err.message || '服务器错误' };
}

// ============================================================
// 一、订单管理
// ============================================================

operationRoutes.post('/orders', async (c) => {
  try {
    const body = await c.req.json();
    const result = await orderService.createOrder(SYSTEM_USER, body);
    c.status(201); return c.json(result);
  } catch (err: any) {
    const e = handlePrismaError(err);
    c.status(e.status); return c.json({ error: e.message });
  }
});

operationRoutes.get('/orders', async (c) => {
  try {
    const page = parseInt(c.req.query('page') || '1');
    const pageSize = parseInt(c.req.query('pageSize') || '20');
    const result = await orderService.getOrders({
      storeId: c.req.query('storeId'),
      productId: c.req.query('productId'),
      status: c.req.query('status'),
      paymentStatus: c.req.query('paymentStatus'),
      shippingStatus: c.req.query('shippingStatus'),
      startDate: c.req.query('startDate'),
      endDate: c.req.query('endDate'),
      keyword: c.req.query('keyword'),
      page,
      pageSize,
    });
    return c.json(result);
  } catch (err: any) {
    const e = handlePrismaError(err);
    c.status(e.status); return c.json({ error: e.message });
  }
});

operationRoutes.get('/orders/:id', async (c) => {
  try {
    const result = await orderService.getOrderDetail(c.req.param('id'));
    return c.json(result);
  } catch (err: any) {
    const e = handlePrismaError(err);
    c.status(e.status); return c.json({ error: e.message });
  }
});

operationRoutes.post('/orders/import', async (c) => {
  try {
    const body = await c.req.json();
    const result = await orderService.importOrders(SYSTEM_USER, body.orders);
    c.status(201); return c.json(result);
  } catch (err: any) {
    const e = handlePrismaError(err);
    c.status(e.status); return c.json({ error: e.message });
  }
});

// ============================================================
// 二、订单费用管理
// ============================================================

operationRoutes.post('/orders/fees', async (c) => {
  try {
    const body = await c.req.json();
    const result = await orderService.addOrderFee(SYSTEM_USER, body);
    c.status(201); return c.json(result);
  } catch (err: any) {
    const e = handlePrismaError(err);
    c.status(e.status); return c.json({ error: e.message });
  }
});

operationRoutes.delete('/orders/fees/:id', async (c) => {
  try {
    const result = await orderService.deleteOrderFee(c.req.param('id'));
    return c.json(result);
  } catch (err: any) {
    const e = handlePrismaError(err);
    c.status(e.status); return c.json({ error: e.message });
  }
});

// ============================================================
// 三、广告管理
// ============================================================

operationRoutes.post('/ads', async (c) => {
  try {
    const body = await c.req.json();
    const result = await adService.createCampaign(SYSTEM_USER, body);
    c.status(201); return c.json(result);
  } catch (err: any) {
    const e = handlePrismaError(err);
    c.status(e.status); return c.json({ error: e.message });
  }
});

operationRoutes.get('/ads', async (c) => {
  try {
    const page = parseInt(c.req.query('page') || '1');
    const pageSize = parseInt(c.req.query('pageSize') || '20');
    const result = await adService.getCampaigns({
      storeId: c.req.query('storeId'),
      campaignType: c.req.query('campaignType'),
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

operationRoutes.get('/ads/spend-summary', async (c) => {
  try {
    const result = await adService.getAdSpendSummary(
      c.req.query('storeId'),
      c.req.query('startDate'),
      c.req.query('endDate'),
    );
    return c.json(result);
  } catch (err: any) {
    const e = handlePrismaError(err);
    c.status(e.status); return c.json({ error: e.message });
  }
});

operationRoutes.put('/ads/:id', async (c) => {
  try {
    const body = await c.req.json();
    const result = await adService.updateCampaign(c.req.param('id'), body);
    return c.json(result);
  } catch (err: any) {
    const e = handlePrismaError(err);
    c.status(e.status); return c.json({ error: e.message });
  }
});

operationRoutes.patch('/ads/:id/end', async (c) => {
  try {
    const result = await adService.endCampaign(c.req.param('id'));
    return c.json(result);
  } catch (err: any) {
    const e = handlePrismaError(err);
    c.status(e.status); return c.json({ error: e.message });
  }
});

// ============================================================
// 四、利润核算
// ============================================================

operationRoutes.post('/profit/calculate', async (c) => {
  try {
    const body = await c.req.json();
    const result = await profitService.calculateOrderProfit(body.orderId, SYSTEM_USER);
    return c.json(result);
  } catch (err: any) {
    const e = handlePrismaError(err);
    c.status(e.status); return c.json({ error: e.message });
  }
});

operationRoutes.get('/profit', async (c) => {
  try {
    const page = parseInt(c.req.query('page') || '1');
    const pageSize = parseInt(c.req.query('pageSize') || '20');
    const result = await profitService.getOrderProfitList({
      startDate: c.req.query('startDate'),
      endDate: c.req.query('endDate'),
      storeId: c.req.query('storeId'),
      productId: c.req.query('productId'),
      page,
      pageSize,
    });
    return c.json(result);
  } catch (err: any) {
    const e = handlePrismaError(err);
    c.status(e.status); return c.json({ error: e.message });
  }
});

operationRoutes.get('/profit/summary', async (c) => {
  try {
    const result = await profitService.getProfitSummary(
      c.req.query('startDate'),
      c.req.query('endDate'),
    );
    return c.json(result);
  } catch (err: any) {
    const e = handlePrismaError(err);
    c.status(e.status); return c.json({ error: e.message });
  }
});

operationRoutes.get('/profit/store', async (c) => {
  try {
    const result = await profitService.getStoreProfit(
      c.req.query('startDate'),
      c.req.query('endDate'),
    );
    return c.json(result);
  } catch (err: any) {
    const e = handlePrismaError(err);
    c.status(e.status); return c.json({ error: e.message });
  }
});

operationRoutes.get('/profit/product', async (c) => {
  try {
    const result = await profitService.getProductProfit(
      c.req.query('startDate'),
      c.req.query('endDate'),
    );
    return c.json(result);
  } catch (err: any) {
    const e = handlePrismaError(err);
    c.status(e.status); return c.json({ error: e.message });
  }
});

export default operationRoutes;
