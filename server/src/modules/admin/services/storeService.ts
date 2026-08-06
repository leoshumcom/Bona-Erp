import { prisma } from '../../../common/prisma';

// ============================================================
// 店铺列表（分页）
// ============================================================
export async function listStores(filters: {
  platformId?: string;
  status?: string;
  page: number;
  pageSize: number;
}) {
  const where: any = {};

  if (filters.platformId) where.platformId = filters.platformId;
  if (filters.status) where.status = filters.status;

  const [data, total] = await Promise.all([
    prisma.store.findMany({
      where,
      include: {
        platform: { select: { id: true, name: true, code: true } },
      },
      skip: (filters.page - 1) * filters.pageSize,
      take: filters.pageSize,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.store.count({ where }),
  ]);

  return { data, total, page: filters.page, pageSize: filters.pageSize };
}

// ============================================================
// 店铺详情
// ============================================================
export async function getStore(id: string) {
  const store = await prisma.store.findUniqueOrThrow({
    where: { id },
    include: {
      platform: true,
      _count: {
        select: {
          orders: true,
          storeProducts: true,
        },
      },
    },
  });

  return {
    ...store,
    orderCount: store._count.orders,
    productCount: store._count.storeProducts,
    _count: undefined,
  };
}

// ============================================================
// 创建店铺
// ============================================================
export async function createStore(params: {
  platformId: string;
  storeName: string;
  storeCode: string;
  marketplaceId?: string | null;
  credentialsJson?: any;
  status?: string;
}) {
  // 验证平台存在
  await prisma.platform.findUniqueOrThrow({ where: { id: params.platformId } });

  const store = await prisma.store.create({
    data: {
      platformId: params.platformId,
      name: params.storeName,
      storeId: params.storeCode,
      region: '默认',
      currency: 'USD',
      tokenInfo: params.credentialsJson,
      storeType: 'self',
      status: params.status || 'active',
    },
    include: {
      platform: { select: { id: true, name: true } },
    },
  });

  return store;
}

// ============================================================
// 更新店铺
// ============================================================
export async function updateStore(
  id: string,
  params: {
    storeName?: string;
    storeCode?: string;
    marketplaceId?: string | null;
    credentialsJson?: any;
    status?: string;
  },
) {
  const data: any = {};

  if (params.storeName !== undefined) data.name = params.storeName;
  if (params.storeCode !== undefined) data.storeId = params.storeCode;
  if (params.credentialsJson !== undefined) data.tokenInfo = params.credentialsJson;
  if (params.status !== undefined) data.status = params.status;

  const store = await prisma.store.update({
    where: { id },
    data,
    include: {
      platform: { select: { id: true, name: true } },
    },
  });

  return store;
}

// ============================================================
// 删除店铺（软删除）
// ============================================================
export async function deleteStore(id: string) {
  const store = await prisma.store.update({
    where: { id },
    data: { status: 'inactive' },
  });

  return { id: store.id, name: store.name, status: store.status };
}
