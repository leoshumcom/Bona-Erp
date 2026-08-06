import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const JWT_SECRET = process.env.JWT_SECRET || 'default-secret';

export async function login(username: string, password: string) {
  const user = await prisma.user.findUnique({ where: { username } });

  if (!user) {
    throw new Error('用户名或密码错误');
  }

  if (user.status !== 'active') {
    throw new Error('账号已被禁用，请联系管理员');
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    throw new Error('用户名或密码错误');
  }

  const token = jwt.sign(
    { userId: user.id, username: user.username, role: user.role },
    JWT_SECRET,
    { expiresIn: '7d' },
  );

  const { passwordHash, ...userWithoutPassword } = user;
  return { token, user: userWithoutPassword };
}

export async function register(params: {
  username: string;
  password: string;
  realName: string;
  email: string;
  role: string;
  companyId?: string;
  departmentId?: string;
}) {
  const existing = await prisma.user.findUnique({ where: { username: params.username } });
  if (existing) {
    throw new Error('用户名已存在');
  }

  let companyId = params.companyId;
  if (!companyId) {
    const firstCompany = await prisma.company.findFirst();
    if (!firstCompany) {
      throw new Error('系统中没有公司，请先创建公司后再注册用户');
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

  const token = jwt.sign(
    { userId: user.id, username: user.username, role: user.role },
    JWT_SECRET,
    { expiresIn: '7d' },
  );

  const { passwordHash: _, ...userWithoutPassword } = user;
  return { token, user: userWithoutPassword };
}

export async function getProfile(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      department: true,
      company: true,
    },
  });

  if (!user) {
    throw new Error('用户不存在');
  }

  const { passwordHash, ...userWithoutPassword } = user;
  return userWithoutPassword;
}
