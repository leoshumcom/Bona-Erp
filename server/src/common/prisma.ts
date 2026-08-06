import { PrismaClient } from '@prisma/client';
import type { D1Database } from '@cloudflare/workers-types';

// 内部实例（可在本地开发和 Worker 中替换）
let _prisma: PrismaClient = new PrismaClient();

// 导出 Proxy，始终代理到当前内部实例
// 解决 Worker 中 D1 初始化后模块导入绑定不更新的问题
export const prisma = new Proxy({} as PrismaClient, {
  get(_, prop: string | symbol) {
    const value = (_prisma as any)[prop];
    if (typeof value === 'function') {
      return value.bind(_prisma);
    }
    return value;
  },
}) as PrismaClient;

let _d1Initialized = false;

/**
 * 在 Cloudflare Workers 中初始化 D1 适配的 PrismaClient
 * Proxy 保证所有已导入的 prisma 引用自动指向新实例
 */
export async function initD1Prisma(d1Binding: D1Database): Promise<PrismaClient> {
  if (!_d1Initialized) {
    const { PrismaD1 } = await import('@prisma/adapter-d1');
    const adapter = new PrismaD1(d1Binding);
    _prisma = new PrismaClient({ adapter });
    _d1Initialized = true;
  }
  return _prisma;
}
