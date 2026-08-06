import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { initD1Prisma } from './common/prisma';

// Cloudflare Workers entry
const app = new Hono();

app.use('*', cors());

// 健康检查
app.get('/api/health', (c) => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ============================================================
// 路由挂载（所有模块使用统一的 prisma 实例）
// ============================================================

// 认证路由
import { authRoutes } from './modules/auth/workerRoutes';
app.route('/api/auth', authRoutes);

// 工厂路由
import factoryRoutes from './modules/factory/workerRoutes';
app.route('/api/factory', factoryRoutes);

// 仓库路由
import warehouseRoutes from './modules/warehouse/workerRoutes';
app.route('/api/warehouse', warehouseRoutes);

// 运营路由
import operationRoutes from './modules/operation/workerRoutes';
app.route('/api/operation', operationRoutes);

// 售后路由
import aftersalesRoutes from './modules/aftersales/workerRoutes';
app.route('/api/aftersales', aftersalesRoutes);

// 老板看板路由
import bossRoutes from './modules/boss/workerRoutes';
app.route('/api/boss', bossRoutes);

// 管理路由
import adminRoutes from './modules/admin/workerRoutes';
app.route('/api/admin', adminRoutes);

// 404
app.all('/api/*', (c) => {
  return c.json({ error: 'Not Found' }, 404);
});

export default {
  async fetch(request: Request, env: any, ctx: any) {
    if (env.DB) {
      await initD1Prisma(env.DB);
    }
    return app.fetch(request, env, ctx);
  },
};
