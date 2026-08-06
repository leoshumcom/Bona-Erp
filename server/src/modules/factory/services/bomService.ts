import { Prisma } from '@prisma/client';
import { prisma } from '../../../common/prisma';

// ============================================================
// BOM 管理
// ============================================================

/**
 * 生成 BOM 编号: BOM-{date}-{seq}
 */
function generateBomNumber(): string {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const seq = Date.now().toString(36).toUpperCase().slice(-4);
  return `BOM-${date}-${seq}`;
}

/**
 * 获取同一产品下一个版本号
 */
async function getNextVersion(productId: string): Promise<number> {
  const latest = await prisma.billOfMaterials.findFirst({
    where: { productId },
    orderBy: { version: 'desc' },
    select: { version: true },
  });
  return (latest?.version ?? 0) + 1;
}

/** 创建 BOM + 行项目 */
export async function createBOM(
  userId: string,
  params: {
    productId: string;
    description?: string;
    baseQuantity: number;
    lines: Array<{
      materialId: string;
      quantity: number;
      unitOfMeasureId: string;
      scrapPercent?: number;
      lineNumber: number;
      notes?: string;
    }>;
  },
) {
  const version = await getNextVersion(params.productId);
  const bomNumber = generateBomNumber();

  // 1. 创建 BOM 头
  const header = await prisma.billOfMaterials.create({
    data: {
      bomNumber,
      productId: params.productId,
      version,
      status: 'DRAFT',
      description: params.description,
      baseQuantity: params.baseQuantity,
      createdById: userId,
    },
  });

  // 2. 批量创建 BOM 行
  const lines = await Promise.all(
    params.lines.map((line) =>
      prisma.billOfMaterialLine.create({
        data: {
          bomId: header.id,
          lineNumber: line.lineNumber,
          materialId: line.materialId,
          quantity: line.quantity,
          unitOfMeasureId: line.unitOfMeasureId,
          scrapPercent: line.scrapPercent ?? 0,
          notes: line.notes,
        },
      }),
    ),
  );

  const bom = { ...header, lines };

  return bom;
}

/** BOM 列表 */
export async function getBOMList(filters: {
  productId?: string;
  status?: string;
  keyword?: string;
  page: number;
  pageSize: number;
}) {
  const where: any = {};

  if (filters.productId) where.productId = filters.productId;
  if (filters.status) where.status = filters.status;
  if (filters.keyword) {
    where.OR = [
      { bomNumber: { contains: filters.keyword } },
      { product: { name: { contains: filters.keyword } } },
    ];
  }

  const [data, total] = await Promise.all([
    prisma.billOfMaterials.findMany({
      where,
      include: {
        product: { select: { id: true, sku: true, name: true } },
        _count: { select: { lines: true } },
      },
      skip: (filters.page - 1) * filters.pageSize,
      take: filters.pageSize,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.billOfMaterials.count({ where }),
  ]);

  return { data, total, page: filters.page, pageSize: filters.pageSize };
}

/** BOM 详情 */
export async function getBOMDetail(id: string) {
  const bom = await prisma.billOfMaterials.findUniqueOrThrow({
    where: { id },
    include: {
      product: { select: { id: true, sku: true, name: true } },
      lines: {
        include: {
          material: { select: { id: true, sku: true, name: true, materialType: true } },
          unitOfMeasure: { select: { id: true, code: true, description: true } },
        },
        orderBy: { lineNumber: 'asc' },
      },
    },
  });

  return bom;
}

/** 激活 BOM（将其他同产品 BOM 设为 INACTIVE） */
export async function activateBOM(id: string) {
  const bom = await prisma.billOfMaterials.findUniqueOrThrow({
    where: { id },
    select: { id: true, productId: true },
  });

  // 1. 将该产品其他所有 ACTIVE BOM 设为 INACTIVE
  await prisma.billOfMaterials.updateMany({
    where: {
      productId: bom.productId,
      status: 'ACTIVE',
      id: { not: id },
    },
    data: { status: 'INACTIVE' },
  });

  // 2. 激活目标 BOM
  const activated = await prisma.billOfMaterials.update({
    where: { id },
    data: {
      status: 'ACTIVE',
      activatedAt: new Date(),
    },
    include: {
      lines: {
        include: {
          material: { select: { id: true, sku: true, name: true } },
          unitOfMeasure: { select: { id: true, code: true } },
        },
      },
    },
  });

  return activated;
}

/** 复制 BOM 到新版本 */
export async function copyBOM(id: string) {
  const source = await prisma.billOfMaterials.findUniqueOrThrow({
    where: { id },
    include: {
      lines: { orderBy: { lineNumber: 'asc' } },
    },
  });

  const newVersion = await getNextVersion(source.productId);
  const bomNumber = generateBomNumber();

  const header = await prisma.billOfMaterials.create({
    data: {
      bomNumber,
      productId: source.productId,
      version: newVersion,
      status: 'DRAFT',
      description: source.description,
      baseQuantity: source.baseQuantity,
      createdById: source.createdById,
    },
  });

  await Promise.all(
    source.lines.map((line) =>
      prisma.billOfMaterialLine.create({
        data: {
          bomId: header.id,
          lineNumber: line.lineNumber,
          materialId: line.materialId,
          quantity: line.quantity,
          unitOfMeasureId: line.unitOfMeasureId,
          scrapPercent: line.scrapPercent,
          notes: line.notes,
        },
      }),
    ),
  );

  return header;
}
