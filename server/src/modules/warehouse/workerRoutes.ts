// @ts-nocheck
import { Hono } from 'hono';
import * as inventoryService from './services/inventoryService';

export const warehouseRoutes = new Hono();

const SYSTEM_USER = 'system';

function handleError(err: any) {
  if (err.name === 'InsufficientStockError') {
    return { status: 409, message: `库存不足: 需要 ${err.needed}, 当前库存 ${err.onHand}` };
  }
  if (err.code === 'P2025') return { status: 404, message: '关联的业务记录不存在' };
  if (err.code === 'P2002') return { status: 409, message: '数据冲突，唯一字段重复' };
  console.error('Warehouse error:', err);
  return { status: 500, message: err.message || '服务器错误' };
}

// ========== 入库 ==========

warehouseRoutes.post('/inbound/production', async (c) => {
  try {
    const body = await c.req.json();
    const result = await inventoryService.inboundProduction(SYSTEM_USER, body);
    return c.json(result);
  } catch (err: any) {
    const e = handleError(err);
    c.status(e.status); return c.json({ error: e.message });
  }
});

warehouseRoutes.post('/inbound/purchase', async (c) => {
  try {
    const body = await c.req.json();
    const result = await inventoryService.inboundPurchase(SYSTEM_USER, body);
    return c.json(result);
  } catch (err: any) {
    const e = handleError(err);
    c.status(e.status); return c.json({ error: e.message });
  }
});

warehouseRoutes.post('/inbound/return', async (c) => {
  try {
    const body = await c.req.json();
    const result = await inventoryService.inboundReturn(SYSTEM_USER, body);
    return c.json(result);
  } catch (err: any) {
    const e = handleError(err);
    c.status(e.status); return c.json({ error: e.message });
  }
});

warehouseRoutes.post('/inbound/initial', async (c) => {
  try {
    const body = await c.req.json();
    const result = await inventoryService.inboundInitial(SYSTEM_USER, body);
    return c.json(result);
  } catch (err: any) {
    const e = handleError(err);
    c.status(e.status); return c.json({ error: e.message });
  }
});

// ========== 出库 ==========

warehouseRoutes.post('/outbound/issue', async (c) => {
  try {
    const body = await c.req.json();
    const result = await inventoryService.outboundIssue(SYSTEM_USER, body);
    return c.json(result);
  } catch (err: any) {
    const e = handleError(err);
    c.status(e.status); return c.json({ error: e.message });
  }
});

warehouseRoutes.post('/outbound/shipment', async (c) => {
  try {
    const body = await c.req.json();
    const result = await inventoryService.outboundShipment(SYSTEM_USER, body);
    return c.json(result);
  } catch (err: any) {
    const e = handleError(err);
    c.status(e.status); return c.json({ error: e.message });
  }
});

warehouseRoutes.post('/outbound/return-stock', async (c) => {
  try {
    const body = await c.req.json();
    const result = await inventoryService.outboundReturnStock(SYSTEM_USER, body);
    return c.json(result);
  } catch (err: any) {
    const e = handleError(err);
    c.status(e.status); return c.json({ error: e.message });
  }
});

// ========== 盘点 ==========

warehouseRoutes.post('/count/plan', async (c) => {
  try {
    const body = await c.req.json();
    const result = await inventoryService.createCountPlan(SYSTEM_USER, body);
    return c.json(result);
  } catch (err: any) {
    const e = handleError(err);
    c.status(e.status); return c.json({ error: e.message });
  }
});

warehouseRoutes.post('/count/adjust', async (c) => {
  try {
    const body = await c.req.json();
    const result = await inventoryService.executeCountAdjust(SYSTEM_USER, body);
    return c.json(result);
  } catch (err: any) {
    const e = handleError(err);
    c.status(e.status); return c.json({ error: e.message });
  }
});

// ========== 查询 ==========

warehouseRoutes.get('/balances', async (c) => {
  try {
    const page = parseInt(c.req.query('page') || '1');
    const pageSize = parseInt(c.req.query('pageSize') || '20');
    const result = await inventoryService.getBalances({
      productId: c.req.query('productId'),
      storageLocationId: c.req.query('storageLocationId'),
      warehouseId: c.req.query('warehouseId'),
      page,
      pageSize,
    });
    return c.json(result);
  } catch (err: any) {
    const e = handleError(err);
    c.status(e.status); return c.json({ error: e.message });
  }
});

warehouseRoutes.get('/ledger', async (c) => {
  try {
    const page = parseInt(c.req.query('page') || '1');
    const pageSize = parseInt(c.req.query('pageSize') || '20');
    const result = await inventoryService.getLedger({
      productId: c.req.query('productId'),
      storageLocationId: c.req.query('storageLocationId'),
      movementType: c.req.query('movementType'),
      startDate: c.req.query('startDate'),
      endDate: c.req.query('endDate'),
      page,
      pageSize,
    });
    return c.json(result);
  } catch (err: any) {
    const e = handleError(err);
    c.status(e.status); return c.json({ error: e.message });
  }
});

warehouseRoutes.get('/lots', async (c) => {
  try {
    const page = parseInt(c.req.query('page') || '1');
    const pageSize = parseInt(c.req.query('pageSize') || '20');
    const result = await inventoryService.getLots({
      productId: c.req.query('productId'),
      storageLocationId: c.req.query('storageLocationId'),
      supplierId: c.req.query('supplierId'),
      page,
      pageSize,
    });
    return c.json(result);
  } catch (err: any) {
    const e = handleError(err);
    c.status(e.status); return c.json({ error: e.message });
  }
});

warehouseRoutes.get('/summary', async (c) => {
  try {
    const warehouseId = c.req.query('warehouseId');
    const result = await inventoryService.getWarehouseSummary(warehouseId);
    return c.json(result);
  } catch (err: any) {
    const e = handleError(err);
    c.status(e.status); return c.json({ error: e.message });
  }
});

export default warehouseRoutes;
