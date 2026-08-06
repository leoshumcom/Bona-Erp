import { Hono } from 'hono';

export const warehouseRoutes = new Hono();

warehouseRoutes.get('/balances', (c) => {
  return c.json({
    message: 'Inventory balance endpoint available',
    note: '全量 Express 路由已实现，Worker 适配器逐步迁移',
  });
});

warehouseRoutes.get('/summary', (c) => {
  return c.json({ message: 'Warehouse summary endpoint' });
});

warehouseRoutes.get('/health', (c) => {
  return c.json({ status: 'ok', module: 'warehouse' });
});
