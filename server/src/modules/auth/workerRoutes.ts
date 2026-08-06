import { Hono } from 'hono';

export const authRoutes = new Hono();

authRoutes.post('/login', async (c) => {
  try {
    const body = await c.req.json();
    // 直接调用服务层函数（Worker 环境下 Express req/res 不可用，需 adapter）
    return c.json({
      message: 'Worker 登录接口：服务层已就绪，请使用完整 Adapter 或 Express 本地开发',
      status: 'available',
    });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

authRoutes.get('/profile', (c) => {
  return c.json({ message: 'Profile endpoint - worker adapter' });
});
