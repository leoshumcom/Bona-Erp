import { PrismaD1 } from '@prisma/adapter-d1';
import { PrismaClient } from '@prisma/client';

/**
 * 为 Cloudflare Workers 创建 Prisma Client 实例
 * 使用 D1 Adapter 连接 Cloudflare D1 数据库
 */
export function createPrismaClient(d1Binding: D1Database): PrismaClient {
  const adapter = new PrismaD1(d1Binding);
  return new PrismaClient({ adapter });
}
