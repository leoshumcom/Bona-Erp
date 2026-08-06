import { prisma } from '../../../common/prisma';

// ============================================================
// 仓库 CRUD
// ============================================================

export async function listWarehouses(filters: {
  search?: string;
  page: number;
  pageSize: number;
}) {
  const where: any = {};

  if (filters.search) {
    where.OR = [
      { name: { contains: filters.search, mode: 'insensitive' } },
      { code: { contains: filters.search, mode: 'insensitive' } },
    ];
  }

  const [data, total] = await Promise.all([
    prisma.warehouse.findMany({
      where,
      include: {
        _count: {
          select: { storageLocations: true },
        },
      },
      skip: (filters.page - 1) * filters.pageSize,
      take: filters.pageSize,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.warehouse.count({ where }),
  ]);

  return { data, total, page: filters.page, pageSize: filters.pageSize };
}

export async function getWarehouse(id: string) {
  const warehouse = await prisma.warehouse.findUniqueOrThrow({
    where: { id },
    include: {
      storageLocations: true,
      _count: {
        select: { orders: true },
      },
    },
  });

  return warehouse;
}

export async function createWarehouse(params: {
  code: string;
  name: string;
  address?: string | null;
  city?: string | null;
  country?: string | null;
  isActive?: boolean;
}) {
  const existing = await prisma.warehouse.findUnique({ where: { code: params.code } });
  if (existing) {
    throw new Error(`仓库编码 "${params.code}" 已存在`);
  }

  const warehouse = await prisma.warehouse.create({
    data: {
      code: params.code,
      name: params.name,
      address: params.address,
      city: params.city,
      country: params.country,
      isActive: params.isActive ?? true,
    },
  });

  return warehouse;
}

export async function updateWarehouse(
  id: string,
  params: {
    name?: string;
    address?: string | null;
    city?: string | null;
    country?: string | null;
    isActive?: boolean;
  },
) {
  const warehouse = await prisma.warehouse.update({
    where: { id },
    data: {
      ...(params.name !== undefined && { name: params.name }),
      ...(params.address !== undefined && { address: params.address }),
      ...(params.city !== undefined && { city: params.city }),
      ...(params.country !== undefined && { country: params.country }),
      ...(params.isActive !== undefined && { isActive: params.isActive }),
    },
  });

  return warehouse;
}

export async function deleteWarehouse(id: string) {
  // 检查是否有库位
  const locations = await prisma.storageLocation.findFirst({
    where: { warehouseId: id },
  });
  if (locations) {
    throw new Error('该仓库下存在库位，无法删除。请先删除所有库位');
  }

  // 检查是否有订单关联
  const orders = await prisma.order.findFirst({
    where: { warehouseId: id, status: { notIn: ['CANCELLED'] } },
  });
  if (orders) {
    throw new Error('该仓库下存在未取消的订单，无法删除');
  }

  await prisma.warehouse.delete({ where: { id } });

  return { id, message: '仓库已删除' };
}

// ============================================================
// 库位 CRUD
// ============================================================

export async function listStorageLocations(warehouseId: string) {
  await prisma.warehouse.findUniqueOrThrow({ where: { id: warehouseId } });

  const locations = await prisma.storageLocation.findMany({
    where: { warehouseId },
    include: {
      _count: {
        select: { inventoryLedger: true },
      },
    },
    orderBy: { code: 'asc' },
  });

  return locations;
}

export async function getStorageLocation(id: string) {
  const location = await prisma.storageLocation.findUniqueOrThrow({
    where: { id },
    include: {
      warehouse: { select: { id: true, code: true, name: true } },
    },
  });

  return location;
}

export async function createStorageLocation(params: {
  warehouseId: string;
  code: string;
  description?: string | null;
  isActive?: boolean;
}) {
  await prisma.warehouse.findUniqueOrThrow({ where: { id: params.warehouseId } });

  const location = await prisma.storageLocation.create({
    data: {
      warehouseId: params.warehouseId,
      code: params.code,
      description: params.description,
      isActive: params.isActive ?? true,
    },
    include: {
      warehouse: { select: { id: true, code: true, name: true } },
    },
  });

  return location;
}

export async function updateStorageLocation(
  id: string,
  params: {
    code?: string;
    description?: string | null;
    isActive?: boolean;
  },
) {
  const location = await prisma.storageLocation.update({
    where: { id },
    data: {
      ...(params.code !== undefined && { code: params.code }),
      ...(params.description !== undefined && { description: params.description }),
      ...(params.isActive !== undefined && { isActive: params.isActive }),
    },
    include: {
      warehouse: { select: { id: true, code: true, name: true } },
    },
  });

  return location;
}

export async function deleteStorageLocation(id: string) {
  // 检查是否有库存余额
  const balances = await prisma.inventoryBalance.findFirst({
    where: { storageLocationId: id, quantityOnHand: { gt: 0 } },
  });
  if (balances) {
    throw new Error('该库位存在库存，无法删除。请先转移库存或将库位停用');
  }

  await prisma.storageLocation.delete({ where: { id } });

  return { id, message: '库位已删除' };
}

// ============================================================
// 仓库详情（含所有库位 + 库存汇总）
// ============================================================
export async function getWarehouseWithLocations(id: string) {
  const warehouse = await prisma.warehouse.findUniqueOrThrow({
    where: { id },
    include: {
      storageLocations: {
        include: {
          _count: {
            select: { inventoryBalances: true },
          },
        },
        orderBy: { code: 'asc' },
      },
    },
  });

  // 汇总库存
  const inventorySummary = await prisma.inventoryBalance.aggregate({
    where: {
      storageLocation: { warehouseId: id },
      quantityOnHand: { gt: 0 },
    },
    _sum: {
      quantityOnHand: true,
      totalCost: true,
    },
    _count: {
      productId: true,
    },
  });

  return {
    ...warehouse,
    inventorySummary: {
      totalQuantity: Number(inventorySummary._sum.quantityOnHand || 0),
      totalCost: Number(inventorySummary._sum.totalCost || 0),
      distinctProducts: inventorySummary._count.productId,
    },
  };
}
