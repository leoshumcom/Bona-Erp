import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { prisma, initD1Prisma } from './common/prisma';

import { authRoutes } from './modules/auth/workerRoutes';
import { factoryRoutes } from './modules/factory/workerRoutes';
import { warehouseRoutes } from './modules/warehouse/workerRoutes';
import { operationRoutes } from './modules/operation/workerRoutes';
import { aftersalesRoutes } from './modules/aftersales/workerRoutes';
import { bossRoutes } from './modules/boss/workerRoutes';
import { adminRoutes } from './modules/admin/workerRoutes';

const app = new Hono();

app.use('*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
}));

app.get('/api/health', (c) => c.json({ status: 'ok', version: '1.0.0' }));

app.route('/api/auth', authRoutes);
app.route('/api/factory', factoryRoutes);
app.route('/api/warehouse', warehouseRoutes);
app.route('/api/operation', operationRoutes);
app.route('/api/aftersales', aftersalesRoutes);
app.route('/api/boss', bossRoutes);
app.route('/api/admin', adminRoutes);

app.all('*', (c) => c.json({ error: 'Not Found' }, 404));

let initialized = false;

export default {
  async fetch(request: Request, env: any, ctx: any) {
    if (!initialized) {
      await initD1Prisma(env.DB);
      initialized = true;
    }
    return app.fetch(request, env, ctx);
  },
};
