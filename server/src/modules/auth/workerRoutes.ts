// @ts-nocheck
import { Hono } from 'hono';
import { prisma } from '../../common/prisma';
import bcryptjs from 'bcryptjs';

// 简单JWT实现（Workers兼容，不依赖Node crypto）
const JWT_SECRET = 'bona-erp-prod-jwt-secret-2026';

function base64url(buf: Uint8Array): string {
  return btoa(String.fromCharCode(...buf)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

async function signToken(payload: any): Promise<string> {
  const encoder = new TextEncoder();
  const header = base64url(encoder.encode(JSON.stringify({ alg: 'HS256', typ: 'JWT' })));
  const body = base64url(encoder.encode(JSON.stringify({ ...payload, iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 7 * 86400 })));
  
  const key = await crypto.subtle.importKey('raw', encoder.encode(JWT_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(`${header}.${body}`));
  
  return `${header}.${body}.${base64url(new Uint8Array(sig))}`;
}

async function verifyToken(token: string): Promise<any> {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Invalid token');
  
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', encoder.encode(JWT_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
  const sigBytes = Uint8Array.from(atob(parts[2].replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
  const valid = await crypto.subtle.verify('HMAC', key, sigBytes, encoder.encode(`${parts[0]}.${parts[1]}`));
  if (!valid) throw new Error('Invalid token');
  
  return JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0))));
}

// ========== Routes ==========

export const authRoutes = new Hono();

authRoutes.post('/login', async (c) => {
  try {
    const { username, password } = await c.req.json();
    if (!username || !password) return c.json({ error: '用户名和密码不能为空' }, 400);

    const user: any = await (prisma as any).user.findUnique({ where: { username } });
    if (!user) return c.json({ error: '用户名或密码错误' }, 401);
    if (user.status !== 'active') return c.json({ error: '账号已被禁用' }, 403);

    const valid = await bcryptjs.compare(password, user.passwordHash);
    if (!valid) return c.json({ error: '用户名或密码错误' }, 401);

    const token = await signToken({ userId: user.id, username: user.username, role: user.role });
    const { passwordHash, ...userWithoutPassword } = user;
    return c.json({ data: { token, user: userWithoutPassword } });
  } catch (err: any) {
    return c.json({ error: err.message || '登录失败' }, 500);
  }
});

authRoutes.post('/register', async (c) => {
  try {
    const body = await c.req.json();
    if (!body.username || !body.password || !body.realName) {
      return c.json({ error: '用户名、密码和真实姓名为必填项' }, 400);
    }

    const existing = await (prisma as any).user.findUnique({ where: { username: body.username } });
    if (existing) return c.json({ error: '用户名已存在' }, 409);

    let companyId = body.companyId;
    if (!companyId) {
      const firstCompany = await (prisma as any).company.findFirst();
      if (!firstCompany) return c.json({ error: '系统中没有公司，请先创建公司' }, 400);
      companyId = firstCompany.id;
    }

    const passwordHash = await bcryptjs.hash(body.password, 10);
    const user = await (prisma as any).user.create({
      data: { username: body.username, passwordHash, realName: body.realName, email: body.email, role: body.role || 'VIEWER', companyId, departmentId: body.departmentId },
    });
    const token = await signToken({ userId: user.id, username: user.username, role: user.role });
    const { passwordHash: _, ...userWithoutPassword } = user;
    return c.json({ data: { token, user: userWithoutPassword } }, 201);
  } catch (err: any) {
    return c.json({ error: err.message || '注册失败' }, 500);
  }
});

authRoutes.get('/profile', async (c) => {
  try {
    const authHeader = c.req.header('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) return c.json({ error: '未登录' }, 401);
    
    const decoded = await verifyToken(authHeader.slice(7));
    const user = await (prisma as any).user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, username: true, realName: true, email: true, phone: true, role: true, status: true },
    });
    if (!user) return c.json({ error: '用户不存在' }, 404);
    return c.json({ data: user });
  } catch (err: any) {
    return c.json({ error: err.message || '获取失败' }, 401);
  }
});

export default authRoutes;
