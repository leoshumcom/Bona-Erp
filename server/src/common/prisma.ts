import { PrismaClient } from '@prisma/client';
import type { D1Database } from '@cloudflare/workers-types';

let _prisma: PrismaClient | null = null;

function ensure(): PrismaClient {
  if (!_prisma) {
    throw new Error('Prisma not initialized');
  }
  return _prisma;
}

export const prisma = new Proxy({} as PrismaClient, {
  get(_, prop: string | symbol) {
    const instance = ensure();
    const value = (instance as any)[prop];
    if (typeof value === 'function') {
      return value.bind(instance);
    }
    return value;
  },
}) as PrismaClient;

export async function initD1Prisma(d1Binding: D1Database): Promise<PrismaClient> {
  const { PrismaD1 } = await import('@prisma/adapter-d1');
  const adapter = new PrismaD1(d1Binding);
  _prisma = new PrismaClient({ adapter });
  return _prisma;
}

export function initLocalPrisma(): PrismaClient {
  _prisma = new PrismaClient();
  return _prisma;
}
