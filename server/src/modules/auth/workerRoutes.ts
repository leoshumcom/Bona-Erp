// @ts-nocheck
import { Hono } from 'hono';
import * as authService from './services/authService';

export const authRoutes = new Hono();

authRoutes.post('/login', async (c) => {
  try {
    const body = await c.req.json();
    const { username, password } = body;
    if (!username || !password) {
      return c.json({ error: '用户名和密码不能为空' }, 400);
    }
    const result = await authService.login(username, password);
    return c.json(result);
  } catch (err: any) {
    if (err.message === '用户名或密码错误') {
      return c.json({ error: err.message }, 401);
    }
    if (err.message === '账号已被禁用，请联系管理员') {
      return c.json({ error: err.message }, 403);
    }
    return c.json({ error: err.message || '登录失败' }, 500);
  }
});

authRoutes.post('/register', async (c) => {
  try {
    const body = await c.req.json();
    const result = await authService.register(body);
    return c.json(result, 201);
  } catch (err: any) {
    if (err.message === '用户名已存在') {
      return c.json({ error: err.message }, 409);
    }
    if (err.message?.includes('请先创建公司')) {
      return c.json({ error: err.message }, 400);
    }
    return c.json({ error: err.message || '注册失败' }, 500);
  }
});

authRoutes.get('/profile', async (c) => {
  try {
    // 从 Authorization header 提取 token
    const authHeader = c.req.header('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return c.json({ error: '未提供有效的认证令牌' }, 401);
    }
    const token = authHeader.slice(7);
    const jwt = await import('jsonwebtoken');
    const decoded: any = jwt.default.verify(token, process.env.JWT_SECRET || 'bona-erp-jwt-secret-change-in-production');
    const result = await authService.getProfile(decoded.userId);
    return c.json(result);
  } catch (err: any) {
    if (err.message === '用户不存在') {
      return c.json({ error: err.message }, 404);
    }
    return c.json({ error: err.message || '获取用户信息失败' }, 500);
  }
});

export default authRoutes;
