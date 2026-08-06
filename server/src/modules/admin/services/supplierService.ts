import { prisma } from '../../../common/prisma';

// ============================================================
// 供应商列表（分页）
// ============================================================
export async function listSuppliers(filters: {
  search?: string;
  status?: string;
  page: number;
  pageSize: number;
}) {
  const where: any = {};

  if (filters.status) where.status = filters.status;

  if (filters.search) {
    where.OR = [
      { name: { contains: filters.search, mode: 'insensitive' } },
      { supplierNumber: { contains: filters.search, mode: 'insensitive' } },
      { contactPerson: { contains: filters.search, mode: 'insensitive' } },
    ];
  }

  const [data, total] = await Promise.all([
    prisma.supplier.findMany({
      where,
      include: {
        _count: {
          select: { materialLots: true },
        },
      },
      skip: (filters.page - 1) * filters.pageSize,
      take: filters.pageSize,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.supplier.count({ where }),
  ]);

  return { data, total, page: filters.page, pageSize: filters.pageSize };
}

// ============================================================
// 供应商详情
// ============================================================
export async function getSupplier(id: string) {
  const supplier = await prisma.supplier.findUniqueOrThrow({
    where: { id },
    include: {
      _count: {
        select: { materialLots: true },
      },
    },
  });

  return {
    ...supplier,
    moldCount: supplier._count.materialLots,
    _count: undefined,
  };
}

// ============================================================
// 创建供应商
// ============================================================
export async function createSupplier(params: {
  supplierNumber: string;
  name: string;
  contactPerson?: string | null;
  contactPhone?: string | null;
  contactEmail?: string | null;
  address?: string | null;
  paymentTerms?: number | null;
  currency?: string;
  status?: string;
}) {
  // 检查编号唯一性
  const existing = await prisma.supplier.findUnique({
    where: { supplierNumber: params.supplierNumber },
  });
  if (existing) {
    throw new Error(`供应商编号 "${params.supplierNumber}" 已存在`);
  }

  const supplier = await prisma.supplier.create({
    data: {
      supplierNumber: params.supplierNumber,
      name: params.name,
      contactPerson: params.contactPerson,
      contactPhone: params.contactPhone,
      contactEmail: params.contactEmail,
      address: params.address,
      paymentTerms: params.paymentTerms,
      currency: params.currency || 'CNY',
      status: params.status || 'active',
    },
  });

  return supplier;
}

// ============================================================
// 更新供应商
// ============================================================
export async function updateSupplier(
  id: string,
  params: {
    name?: string;
    contactPerson?: string | null;
    contactPhone?: string | null;
    contactEmail?: string | null;
    address?: string | null;
    paymentTerms?: number | null;
    currency?: string;
    status?: string;
  },
) {
  const supplier = await prisma.supplier.update({
    where: { id },
    data: {
      ...(params.name !== undefined && { name: params.name }),
      ...(params.contactPerson !== undefined && { contactPerson: params.contactPerson }),
      ...(params.contactPhone !== undefined && { contactPhone: params.contactPhone }),
      ...(params.contactEmail !== undefined && { contactEmail: params.contactEmail }),
      ...(params.address !== undefined && { address: params.address }),
      ...(params.paymentTerms !== undefined && { paymentTerms: params.paymentTerms }),
      ...(params.currency !== undefined && { currency: params.currency }),
      ...(params.status !== undefined && { status: params.status }),
    },
  });

  return supplier;
}

// ============================================================
// 删除供应商（软删除）
// ============================================================
export async function deleteSupplier(id: string) {
  const supplier = await prisma.supplier.update({
    where: { id },
    data: { status: 'inactive' },
  });

  return { id: supplier.id, name: supplier.name, status: supplier.status };
}
