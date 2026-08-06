import { z } from 'zod';

export const loginSchema = z.object({
  username: z.string().min(2, '用户名至少2个字符'),
  password: z.string().min(6, '密码至少6个字符'),
});

export const registerSchema = z.object({
  username: z.string().min(2, '用户名至少2个字符'),
  password: z.string().min(6, '密码至少6个字符'),
  realName: z.string().min(1, '真实姓名不能为空'),
  email: z.string().email('邮箱格式不正确'),
  role: z.enum(['ADMIN', 'BOSS', 'FACTORY_MANAGER', 'OPERATOR', 'WAREHOUSE_MANAGER', 'AFTERSALES', 'VIEWER'], {
    errorMap: () => ({ message: '角色类型无效' }),
  }),
  companyId: z.string().uuid('公司ID格式无效').optional(),
  departmentId: z.string().uuid('部门ID格式无效').optional(),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
