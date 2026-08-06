import { prisma } from '../../../common/prisma';

// ============================================================
// 产品列表（分页）
// ============================================================
export async function listProducts(filters: {
  search?: string;
  category?: string;
  materialType?: string;
  status?: string;
  page: number;
  pageSize: number;
}) {
  const where: any = {};

  if (filters.category) where.category = filters.category;
  if (filters.materialType) where.materialType = filters.materialType;
  if (filters.status) where.status = filters.status;

  if (filters.search) {
    where.OR = [
      { sku: { contains: filters.search, mode: 'insensitive' } },
      { name: { contains: filters.search, mode: 'insensitive' } },
      { nameEn: { contains: filters.search, mode: 'insensitive' } },
    ];
  }

  const [data, total] = await Promise.all([
    prisma.product.findMany({
      where,
      include: {
        unitOfMeasure: { select: { id: true, code: true, description: true } },
      },
      skip: (filters.page - 1) * filters.pageSize,
      take: filters.pageSize,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.product.count({ where }),
  ]);

  return { data, total, page: filters.page, pageSize: filters.pageSize };
}

// ============================================================
// 产品详情
// ============================================================
export async function getProduct(id: string) {
  const product = await prisma.product.findUniqueOrThrow({
    where: { id },
    include: {
      unitOfMeasure: true,
      bomsAsParent: {
        where: { status: 'ACTIVE' },
        include: {
          lines: {
            include: {
              material: { select: { id: true, sku: true, name: true } },
              unitOfMeasure: { select: { id: true, code: true } },
            },
          },
        },
        orderBy: { version: 'desc' },
        take: 1,
      },
      storeProducts: {
        include: {
          store: { select: { id: true, name: true, storeId: true } },
        },
      },
    },
  });

  return product;
}

// ============================================================
// 创建产品
// ============================================================
export async function createProduct(params: {
  sku: string;
  name: string;
  description?: string | null;
  brand?: string | null;
  category?: string | null;
  materialType?: string;
  unitOfMeasureId: string;
  imageUrl?: string | null;
  status?: string;
}) {
  // 检查SKU唯一性
  const existing = await prisma.product.findUnique({ where: { sku: params.sku } });
  if (existing) {
    throw new Error(`SKU "${params.sku}" 已存在`);
  }

  // 验证单位存在
  await prisma.unitOfMeasure.findUniqueOrThrow({ where: { id: params.unitOfMeasureId } });

  const product = await prisma.product.create({
    data: {
      sku: params.sku,
      name: params.name,
      description: params.description,
      brand: params.brand,
      category: params.category,
      materialType: (params.materialType || 'FINISHED_GOOD') as any,
      unitOfMeasureId: params.unitOfMeasureId,
      imageUrl: params.imageUrl,
      status: params.status || 'active',
    },
    include: {
      unitOfMeasure: { select: { id: true, code: true, description: true } },
    },
  });

  return product;
}

// ============================================================
// 更新产品
// ============================================================
export async function updateProduct(
  id: string,
  params: {
    name?: string;
    description?: string | null;
    brand?: string | null;
    category?: string | null;
    materialType?: string;
    unitOfMeasureId?: string;
    imageUrl?: string | null;
    status?: string;
  },
) {
  if (params.unitOfMeasureId) {
    await prisma.unitOfMeasure.findUniqueOrThrow({ where: { id: params.unitOfMeasureId } });
  }

  const product = await prisma.product.update({
    where: { id },
    data: {
      ...(params.name !== undefined && { name: params.name }),
      ...(params.description !== undefined && { description: params.description }),
      ...(params.brand !== undefined && { brand: params.brand }),
      ...(params.category !== undefined && { category: params.category }),
      ...(params.materialType !== undefined && { materialType: params.materialType as any }),
      ...(params.unitOfMeasureId !== undefined && { unitOfMeasureId: params.unitOfMeasureId }),
      ...(params.imageUrl !== undefined && { imageUrl: params.imageUrl }),
      ...(params.status !== undefined && { status: params.status }),
    },
    include: {
      unitOfMeasure: { select: { id: true, code: true, description: true } },
    },
  });

  return product;
}

// ============================================================
// 删除产品（检查关联）
// ============================================================
export async function deleteProduct(id: string) {
  // 检查是否有活跃的订单明细
  const activeOrderItems = await prisma.orderItem.findFirst({
    where: {
      productId: id,
      order: { status: { notIn: ['CANCELLED'] } },
    },
  });
  if (activeOrderItems) {
    throw new Error('该产品存在未取消的订单，无法删除。请先将产品状态设为"停用"');
  }

  // 检查是否有活跃的BOM
  const activeBOM = await prisma.billOfMaterials.findFirst({
    where: { productId: id, status: { in: ['ACTIVE', 'DRAFT'] } },
  });
  if (activeBOM) {
    throw new Error('该产品存在活跃的BOM，无法删除。请先将产品状态设为"停用"');
  }

  // 检查是否有活跃的生产工单
  const activePO = await prisma.productionOrder.findFirst({
    where: { productId: id, status: { notIn: ['CANCELLED', 'CLOSED'] } },
  });
  if (activePO) {
    throw new Error('该产品存在进行中的生产工单，无法删除');
  }

  await prisma.product.delete({ where: { id } });

  return { id, message: '产品已删除' };
}

// ============================================================
// 批量导入产品
// ============================================================
export async function bulkImport(
  products: Array<{
    sku: string;
    name: string;
    description?: string | null;
    brand?: string | null;
    category?: string | null;
    materialType?: string;
    unitOfMeasureId: string;
    imageUrl?: string | null;
    status?: string;
  }>,
) {
  let successCount = 0;
  let failCount = 0;
  const errors: Array<{ sku: string; error: string }> = [];

  for (const params of products) {
    try {
      const existing = await prisma.product.findUnique({ where: { sku: params.sku } });
      if (existing) {
        failCount++;
        errors.push({ sku: params.sku, error: 'SKU已存在' });
        continue;
      }

      await prisma.unitOfMeasure.findUniqueOrThrow({ where: { id: params.unitOfMeasureId } });

      await prisma.product.create({
        data: {
          sku: params.sku,
          name: params.name,
          description: params.description,
          brand: params.brand,
          category: params.category,
          materialType: (params.materialType || 'FINISHED_GOOD') as any,
          unitOfMeasureId: params.unitOfMeasureId,
          imageUrl: params.imageUrl,
          status: params.status || 'active',
        },
      });
      successCount++;
    } catch (err: any) {
      failCount++;
      errors.push({ sku: params.sku, error: err.message || '导入失败' });
    }
  }

  return {
    total: products.length,
    successCount,
    failCount,
    errors: errors.length > 0 ? errors : undefined,
  };
}

// ============================================================
// 产品统计
// ============================================================
export async function getProductStats(productId: string) {
  // 确保产品存在
  await prisma.product.findUniqueOrThrow({ where: { id: productId } });

  // 总订单数
  const totalOrders = await prisma.orderItem.count({
    where: { productId },
  });

  // 总销售额
  const revenueResult = await prisma.orderItem.aggregate({
    where: {
      productId,
      order: { status: { not: 'CANCELLED' } },
    },
    _sum: { totalAmount: true },
  });
  const totalRevenue = revenueResult._sum.totalAmount || 0;

  // 利润数据
  const profitData = await prisma.orderProfit.findMany({
    where: {
      order: {
        items: { some: { productId } },
      },
    },
    select: {
      netProfit: true,
      salesAmount: true,
    },
  });

  let totalProfit = 0;
  let totalSales = 0;
  for (const p of profitData) {
    totalProfit += Number(p.netProfit);
    totalSales += Number(p.salesAmount);
  }
  const profitMargin = totalSales > 0 ? totalProfit / totalSales : 0;

  // 库存水平
  const stockResult = await prisma.inventoryBalance.aggregate({
    where: { productId },
    _sum: { quantityOnHand: true },
  });
  const totalStock = stockResult._sum.quantityOnHand || 0;

  return {
    productId,
    totalOrders,
    totalRevenue: Number(totalRevenue),
    totalProfit: totalProfit,
    profitMargin: Math.round(profitMargin * 10000) / 100,
    totalStock: Number(totalStock),
  };
}
