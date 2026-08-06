import { prisma } from '../../../common/prisma';
import bcrypt from 'bcryptjs';

// ============================================================
// 用户列表（分页）
// ============================================================
export async function listUsers(filters: {
  search?: string;
  role?: string;
  status?: string;
  page: number;
  pageSize: number;
}) {
  const where: any = {};

  if (filters.role) where.role = filters.role;
  if (filters.status) where.status = filters.status;

  if (filters.search) {
    where.OR = [
      { username: { contains: filters.search, mode: 'insensitive' } },
      { realName: { contains: filters.search, mode: 'insensitive' } },
      { email: { contains: filters.search, mode: 'insensitive' } },
    ];
  }

  const [data, total] = await Promise.all([
    prisma.user.findMany({
      where,
      include: {
        company: { select: { id: true, name: true } },
        department: { select: { id: true, name: true } },
      },
      skip: (filters.page - 1) * filters.pageSize,
      take: filters.pageSize,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.user.count({ where }),
  ]);

  // 排除密码字段
  const users = data.map(({ passwordHash, ...rest }) => rest);

  return { data: users, total, page: filters.page, pageSize: filters.pageSize };
}

// ============================================================
// 用户详情
// ============================================================
export async function getUser(id: string) {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id },
    include: {
      company: true,
      department: true,
    },
  });

  const { passwordHash, ...userWithoutPassword } = user;
  return userWithoutPassword;
}

// ============================================================
// 创建用户
// ============================================================
export async function createUser(params: {
  username: string;
  password: string;
  realName: string;
  email?: string | null;
  role: string;
  companyId?: string | null;
  departmentId?: string | null;
}) {
  // 检查用户名唯一性
  const existing = await prisma.user.findUnique({ where: { username: params.username } });
  if (existing) {
    throw new Error('用户名已存在');
  }

  let companyId = params.companyId;
  if (!companyId) {
    const firstCompany = await prisma.company.findFirst();
    if (!firstCompany) {
      throw new Error('系统中没有公司，请先创建公司后再创建用户');
    }
    companyId = firstCompany.id;
  }

  const passwordHash = await bcrypt.hash(params.password, 10);

  const user = await prisma.user.create({
    data: {
      username: params.username,
      passwordHash,
      realName: params.realName,
      email: params.email,
      role: params.role as any,
      companyId,
      departmentId: params.departmentId,
    },
  });

  const { passwordHash: _, ...userWithoutPassword } = user;
  return userWithoutPassword;
}

// ============================================================
// 更新用户
// ============================================================
export async function updateUser(
  id: string,
  params: {
    realName?: string;
    email?: string | null;
    role?: string;
    departmentId?: string | null;
    status?: string;
  },
  currentUserId?: string,
) {
  // 不允许降级自己的角色
  if (currentUserId === id && params.role) {
    const currentUser = await prisma.user.findUnique({ where: { id } });
    if (currentUser && currentUser.role === 'ADMIN' && params.role !== 'ADMIN') {
      throw new Error('不允许将自己的管理员角色降级，请联系其他管理员操作');
    }
  }

  const user = await prisma.user.update({
    where: { id },
    data: {
      ...(params.realName !== undefined && { realName: params.realName }),
      ...(params.email !== undefined && { email: params.email }),
      ...(params.role !== undefined && { role: params.role as any }),
      ...(params.departmentId !== undefined && { departmentId: params.departmentId }),
      ...(params.status !== undefined && { status: params.status }),
    },
    include: {
      company: { select: { id: true, name: true } },
      department: { select: { id: true, name: true } },
    },
  });

  const { passwordHash, ...userWithoutPassword } = user;
  return userWithoutPassword;
}

// ============================================================
// 删除用户（软删除）
// ============================================================
export async function deleteUser(id: string) {
  const user = await prisma.user.update({
    where: { id },
    data: { status: 'disabled' },
  });

  return { id: user.id, username: user.username, status: user.status };
}

// ============================================================
// 重置密码
// ============================================================
export async function resetPassword(id: string, newPassword: string) {
  const passwordHash = await bcrypt.hash(newPassword, 10);

  const user = await prisma.user.update({
    where: { id },
    data: { passwordHash },
  });

  return { id: user.id, username: user.username, message: '密码已重置' };
}

// ============================================================
// 按公司查询用户
// ============================================================
export async function getUsersByCompany(companyId: string) {
  const users = await prisma.user.findMany({
    where: { companyId, status: 'active' },
    select: {
      id: true,
      username: true,
      realName: true,
      email: true,
      role: true,
      status: true,
      department: { select: { id: true, name: true } },
    },
    orderBy: { realName: 'asc' },
  });

  return users;
}

// ============================================================
// 按角色查询用户
// ============================================================
export async function getUsersByRole(role: string) {
  const users = await prisma.user.findMany({
    where: { role: role as any, status: 'active' },
    select: {
      id: true,
      username: true,
      realName: true,
      email: true,
      role: true,
      status: true,
      company: { select: { id: true, name: true } },
      department: { select: { id: true, name: true } },
    },
    orderBy: { realName: 'asc' },
  });

  return users;
}
