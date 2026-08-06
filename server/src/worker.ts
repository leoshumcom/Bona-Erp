import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { jwt } from 'hono/jwt';

const app = new Hono();

app.use('*', cors());

// 健康检查（无需认证）
app.get('/api/health', (c) => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 认证路由
import { authRoutes } from './modules/auth/workerRoutes';
app.route('/api/auth', authRoutes);

// 仓库路由
import { warehouseRoutes } from './modules/warehouse/workerRoutes';
app.route('/api/warehouse', warehouseRoutes);

// 其他模块路由（从模块化 worker routes 导入，或直接代理）
// 目前服务层已完整实现，但 Worker 路由适配需要逐步迁移
// 本地开发请使用 npm run dev (Express)
app.get('/api/*', (c) => {
  const path = c.req.path;
  const modules = ['auth', 'warehouse', 'factory', 'operation', 'aftersales', 'boss', 'admin'];
  const matched = modules.some((m) => path.startsWith(`/api/${m}`));
  
  if (matched) {
    return c.json({ 
      message: 'Worker 路由正在迁移中，本地开发请使用 npm run dev (Express)',
      path,
      note: '服务层函数已全部可用，Worker 路由适配器逐步上线'
    }, 503);
  }
  
  return c.json({ error: 'Not Found' }, 404);
});

export default app;
