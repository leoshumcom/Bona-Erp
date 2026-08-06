import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';

const app = new Hono();

// 中间件
app.use('*', cors());
app.use('*', logger());

// 健康检查
app.get('/api/health', (c) => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API 路由 - 待挂载各模块路由
app.get('/api', (c) => {
  return c.json({ name: '博纳ERP API', version: '1.0.0' });
});

// 工厂端路由
const factory = new Hono();
factory.get('/', (c) => c.json({ module: 'factory', message: '工厂端 - 待实现' }));
app.route('/api/factory', factory);

// 仓库端路由
const warehouse = new Hono();
warehouse.get('/', (c) => c.json({ module: 'warehouse', message: '仓库端 - 待实现' }));
app.route('/api/warehouse', warehouse);

// 运营端路由
const operation = new Hono();
operation.get('/', (c) => c.json({ module: 'operation', message: '运营端 - 待实现' }));
app.route('/api/operation', operation);

// 售后端路由
const aftersales = new Hono();
aftersales.get('/', (c) => c.json({ module: 'aftersales', message: '售后端 - 待实现' }));
app.route('/api/aftersales', aftersales);

// 老板端路由
const boss = new Hono();
boss.get('/', (c) => c.json({ module: 'boss', message: '老板端 - 待实现' }));
app.route('/api/boss', boss);

// 认证路由
const auth = new Hono();
auth.post('/login', (c) => c.json({ message: '登录接口 - 待实现' }));
app.route('/api/auth', auth);

export default app;
