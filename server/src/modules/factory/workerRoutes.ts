// @ts-nocheck
import { Hono } from 'hono';
import * as moldService from './services/moldService';
import * as bomService from './services/bomService';
import * as productionService from './services/productionService';
import * as costService from './services/costService';

export const factoryRoutes = new Hono();

const SYSTEM_USER = 'system';

function handlePrismaError(err: any) {
  if (err.code === 'P2025') return { status: 404, message: '关联的业务记录不存在' };
  if (err.code === 'P2002') return { status: 409, message: '数据冲突，唯一字段重复' };
  return { status: 500, message: err.message || '服务器错误' };
}

// ============================================================
// 一、模具管理
// ============================================================

factoryRoutes.post('/molds', async (c) => {
  try {
    const body = await c.req.json();
    const result = await moldService.createMold(SYSTEM_USER, body);
    return c.json(result);
  } catch (err: any) {
    const e = handlePrismaError(err);
    c.status(e.status); return c.json({ error: e.message });
  }
});

factoryRoutes.get('/molds', async (c) => {
  try {
    const page = parseInt(c.req.query('page') || '1');
    const pageSize = parseInt(c.req.query('pageSize') || '20');
    const result = await moldService.getMolds({
      status: c.req.query('status'),
      productId: c.req.query('productId'),
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

factoryRoutes.get('/molds/:id', async (c) => {
  try {
    const result = await moldService.getMoldDetail(c.req.param('id'));
    return c.json(result);
  } catch (err: any) {
    const e = handlePrismaError(err);
    c.status(e.status); return c.json({ error: e.message });
  }
});

factoryRoutes.put('/molds/:id', async (c) => {
  try {
    const body = await c.req.json();
    const result = await moldService.updateMold(c.req.param('id'), body);
    return c.json(result);
  } catch (err: any) {
    const e = handlePrismaError(err);
    c.status(e.status); return c.json({ error: e.message });
  }
});

factoryRoutes.post('/molds/:id/expenses', async (c) => {
  try {
    const body = await c.req.json();
    const result = await moldService.recordMoldExpense(SYSTEM_USER, {
      ...body,
      moldId: c.req.param('id'),
    });
    return c.json(result);
  } catch (err: any) {
    const e = handlePrismaError(err);
    c.status(e.status); return c.json({ error: e.message });
  }
});

factoryRoutes.get('/molds/:id/expense-summary', async (c) => {
  try {
    const result = await moldService.getMoldExpenseSummary(c.req.param('id'));
    return c.json(result);
  } catch (err: any) {
    const e = handlePrismaError(err);
    c.status(e.status); return c.json({ error: e.message });
  }
});

factoryRoutes.get('/mold-depreciations', async (c) => {
  try {
    const page = parseInt(c.req.query('page') || '1');
    const pageSize = parseInt(c.req.query('pageSize') || '20');
    const result = await moldService.getMoldDepreciation({
      moldId: c.req.query('moldId'),
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

// ============================================================
// 二、BOM 管理
// ============================================================

factoryRoutes.post('/boms', async (c) => {
  try {
    const body = await c.req.json();
    const result = await bomService.createBOM(SYSTEM_USER, body);
    return c.json(result);
  } catch (err: any) {
    const e = handlePrismaError(err);
    c.status(e.status); return c.json({ error: e.message });
  }
});

factoryRoutes.get('/boms', async (c) => {
  try {
    const page = parseInt(c.req.query('page') || '1');
    const pageSize = parseInt(c.req.query('pageSize') || '20');
    const result = await bomService.getBOMList({
      productId: c.req.query('productId'),
      status: c.req.query('status'),
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

factoryRoutes.get('/boms/:id', async (c) => {
  try {
    const result = await bomService.getBOMDetail(c.req.param('id'));
    return c.json(result);
  } catch (err: any) {
    const e = handlePrismaError(err);
    c.status(e.status); return c.json({ error: e.message });
  }
});

factoryRoutes.post('/boms/:id/activate', async (c) => {
  try {
    const result = await bomService.activateBOM(c.req.param('id'));
    return c.json(result);
  } catch (err: any) {
    const e = handlePrismaError(err);
    c.status(e.status); return c.json({ error: e.message });
  }
});

factoryRoutes.post('/boms/:id/copy', async (c) => {
  try {
    const result = await bomService.copyBOM(c.req.param('id'));
    return c.json(result);
  } catch (err: any) {
    const e = handlePrismaError(err);
    c.status(e.status); return c.json({ error: e.message });
  }
});

// ============================================================
// 三、生产工单管理
// ============================================================

factoryRoutes.post('/production-orders', async (c) => {
  try {
    const body = await c.req.json();
    const result = await productionService.createProductionOrder(SYSTEM_USER, body);
    return c.json(result);
  } catch (err: any) {
    if (err.name === 'StatusTransitionError') {
      return c.json({ error: err.message }, 409);
    }
    const e = handlePrismaError(err);
    c.status(e.status); return c.json({ error: e.message });
  }
});

factoryRoutes.get('/production-orders', async (c) => {
  try {
    const page = parseInt(c.req.query('page') || '1');
    const pageSize = parseInt(c.req.query('pageSize') || '20');
    const result = await productionService.getProductionOrders({
      status: c.req.query('status'),
      productId: c.req.query('productId'),
      keyword: c.req.query('keyword'),
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

factoryRoutes.get('/production-orders/:id', async (c) => {
  try {
    const result = await productionService.getProductionOrderDetail(c.req.param('id'));
    return c.json(result);
  } catch (err: any) {
    const e = handlePrismaError(err);
    c.status(e.status); return c.json({ error: e.message });
  }
});

factoryRoutes.put('/production-orders/:id/status', async (c) => {
  try {
    const body = await c.req.json();
    const result = await productionService.updateStatus(c.req.param('id'), body.status, SYSTEM_USER);
    return c.json(result);
  } catch (err: any) {
    if (err.name === 'StatusTransitionError') {
      return c.json({ error: err.message }, 409);
    }
    const e = handlePrismaError(err);
    c.status(e.status); return c.json({ error: e.message });
  }
});

factoryRoutes.post('/production-orders/:id/start', async (c) => {
  try {
    const result = await productionService.startProduction(c.req.param('id'));
    return c.json(result);
  } catch (err: any) {
    if (err.name === 'StatusTransitionError') {
      return c.json({ error: err.message }, 409);
    }
    const e = handlePrismaError(err);
    c.status(e.status); return c.json({ error: e.message });
  }
});

factoryRoutes.post('/production-orders/:id/complete', async (c) => {
  try {
    const result = await productionService.completeProduction(c.req.param('id'));
    return c.json(result);
  } catch (err: any) {
    if (err.name === 'StatusTransitionError') {
      return c.json({ error: err.message }, 409);
    }
    const e = handlePrismaError(err);
    c.status(e.status); return c.json({ error: e.message });
  }
});

factoryRoutes.post('/production-orders/:id/release', async (c) => {
  try {
    const result = await productionService.releaseProductionOrder(c.req.param('id'));
    return c.json(result);
  } catch (err: any) {
    if (err.name === 'StatusTransitionError') {
      return c.json({ error: err.message }, 409);
    }
    const e = handlePrismaError(err);
    c.status(e.status); return c.json({ error: e.message });
  }
});

factoryRoutes.post('/production-orders/:id/cancel', async (c) => {
  try {
    const result = await productionService.cancelProductionOrder(c.req.param('id'));
    return c.json(result);
  } catch (err: any) {
    if (err.name === 'StatusTransitionError') {
      return c.json({ error: err.message }, 409);
    }
    const e = handlePrismaError(err);
    c.status(e.status); return c.json({ error: e.message });
  }
});

factoryRoutes.post('/production-orders/:id/costs', async (c) => {
  try {
    const body = await c.req.json();
    const result = await productionService.recordProductionCost(SYSTEM_USER, {
      ...body,
      productionOrderId: c.req.param('id'),
    });
    return c.json(result);
  } catch (err: any) {
    const e = handlePrismaError(err);
    c.status(e.status); return c.json({ error: e.message });
  }
});

// ============================================================
// 四、工厂成本核算
// ============================================================

factoryRoutes.get('/costs/production-order/:id', async (c) => {
  try {
    const result = await costService.getProductionCostSummary(c.req.param('id'));
    return c.json(result);
  } catch (err: any) {
    const e = handlePrismaError(err);
    c.status(e.status); return c.json({ error: e.message });
  }
});

factoryRoutes.get('/costs/product-breakdown', async (c) => {
  try {
    const result = await costService.getProductCostBreakdown(
      c.req.query('productId')!,
      c.req.query('startDate'),
      c.req.query('endDate'),
    );
    return c.json(result);
  } catch (err: any) {
    const e = handlePrismaError(err);
    c.status(e.status); return c.json({ error: e.message });
  }
});

factoryRoutes.get('/costs/mold-allocation/:productId', async (c) => {
  try {
    const result = await costService.getMoldCostAllocation(c.req.param('productId'));
    return c.json(result);
  } catch (err: any) {
    const e = handlePrismaError(err);
    c.status(e.status); return c.json({ error: e.message });
  }
});

factoryRoutes.get('/costs/overhead', async (c) => {
  try {
    const result = await costService.getFactoryOverhead(c.req.query('period') || '');
    return c.json(result);
  } catch (err: any) {
    const e = handlePrismaError(err);
    c.status(e.status); return c.json({ error: e.message });
  }
});

// ============================================================
// 五、工厂固定费用管理
// ============================================================

factoryRoutes.post('/fixed-expenses', async (c) => {
  try {
    const body = await c.req.json();
    const result = await costService.recordFactoryExpense(SYSTEM_USER, body);
    return c.json(result);
  } catch (err: any) {
    const e = handlePrismaError(err);
    c.status(e.status); return c.json({ error: e.message });
  }
});

factoryRoutes.get('/fixed-expenses', async (c) => {
  try {
    const page = parseInt(c.req.query('page') || '1');
    const pageSize = parseInt(c.req.query('pageSize') || '20');
    const result = await costService.getFactoryExpenses({
      expenseMonth: c.req.query('expenseMonth'),
      expenseType: c.req.query('expenseType'),
      page,
      pageSize,
    });
    return c.json(result);
  } catch (err: any) {
    const e = handlePrismaError(err);
    c.status(e.status); return c.json({ error: e.message });
  }
});

export default factoryRoutes;
