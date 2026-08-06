import { prisma } from '../../../common/prisma';

// ============================================================
// 公司列表（分页）
// ============================================================
export async function listCompanies(filters: {
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
    prisma.company.findMany({
      where,
      include: {
        _count: {
          select: { users: true, departments: true },
        },
      },
      skip: (filters.page - 1) * filters.pageSize,
      take: filters.pageSize,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.company.count({ where }),
  ]);

  return { data, total, page: filters.page, pageSize: filters.pageSize };
}

// ============================================================
// 公司详情
// ============================================================
export async function getCompany(id: string) {
  const company = await prisma.company.findUniqueOrThrow({
    where: { id },
    include: {
      departments: {
        orderBy: { name: 'asc' },
      },
      _count: {
        select: { users: true },
      },
    },
  });

  return company;
}

// ============================================================
// 创建公司
// ============================================================
export async function createCompany(params: {
  code: string;
  name: string;
  address?: string | null;
  contactPerson?: string | null;
  phone?: string | null;
  email?: string | null;
  currency?: string;
}) {
  // 检查编码唯一性
  const existing = await prisma.company.findUnique({ where: { code: params.code } });
  if (existing) {
    throw new Error(`公司编码 "${params.code}" 已存在`);
  }

  const company = await prisma.company.create({
    data: {
      code: params.code,
      name: params.name,
      address: params.address,
      contactPerson: params.contactPerson,
      phone: params.phone,
      email: params.email,
      currency: params.currency || 'CNY',
    },
  });

  return company;
}

// ============================================================
// 更新公司
// ============================================================
export async function updateCompany(
  id: string,
  params: {
    name?: string;
    address?: string | null;
    contactPerson?: string | null;
    phone?: string | null;
    email?: string | null;
    currency?: string;
  },
) {
  const company = await prisma.company.update({
    where: { id },
    data: {
      ...(params.name !== undefined && { name: params.name }),
      ...(params.address !== undefined && { address: params.address }),
      ...(params.contactPerson !== undefined && { contactPerson: params.contactPerson }),
      ...(params.phone !== undefined && { phone: params.phone }),
      ...(params.email !== undefined && { email: params.email }),
      ...(params.currency !== undefined && { currency: params.currency }),
    },
  });

  return company;
}

// ============================================================
// 删除公司
// ============================================================
export async function deleteCompany(id: string) {
  // 检查是否有活跃用户
  const activeUsers = await prisma.user.findFirst({
    where: { companyId: id, status: 'active' },
  });
  if (activeUsers) {
    throw new Error('该公司下存在活跃用户，无法删除。请先处理相关用户');
  }

  // 检查是否有部门
  const departments = await prisma.department.findFirst({
    where: { companyId: id },
  });
  if (departments) {
    throw new Error('该公司下存在部门，无法删除。请先删除所有部门');
  }

  await prisma.company.delete({ where: { id } });

  return { id, message: '公司已删除' };
}
