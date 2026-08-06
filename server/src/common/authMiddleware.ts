// @ts-nocheck
// 共享认证中间件 — Workers兼容（Web Crypto API）
import type { Context, Next } from 'hono';

const JWT_SECRET = 'bona-erp-prod-jwt-secret-2026';

export async function verifyToken(token: string): Promise<any> {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Invalid token');

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', encoder.encode(JWT_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
  const sigBytes = Uint8Array.from(atob(parts[2].replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
  const valid = await crypto.subtle.verify('HMAC', key, sigBytes, encoder.encode(`${parts[0]}.${parts[1]}`));
  if (!valid) throw new Error('Invalid token');

  return JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0))));
}

/** 提取当前用户ID（无需JWT也可使用SYSTEM_USER兜底） */
export async function authMiddleware(c: Context, next: Next) {
  const authHeader = c.req.header('Authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const payload = await verifyToken(authHeader.slice(7));
      c.set('userId', payload.userId);
    } catch {
      // token无效，使用默认ID
      c.set('userId', 'system');
    }
  } else {
    c.set('userId', 'system');
  }
  await next();
}

/** 获取当前请求的用户ID */
export function getUserId(c: Context): string {
  return c.get('userId') || 'system';
}
