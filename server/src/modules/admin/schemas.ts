import { z } from 'zod';

// ============================================================
// 用户管理
// ============================================================

export const userQuerySchema = z.object({
  search: z.string().optional(),
  role: z.string().optional(),
  status: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const userCreateSchema = z.object({
  username: z.string().min(2, '用户名至少2个字符'),
  password: z.string().min(6, '密码至少6个字符'),
  realName: z.string().min(1, '真实姓名不能为空'),
  email: z.string().email('邮箱格式不正确').optional().nullable(),
  role: z.enum(['ADMIN', 'BOSS', 'FACTORY_MANAGER', 'OPERATOR', 'WAREHOUSE_MANAGER', 'AFTERSALES', 'VIEWER'], {
    errorMap: () => ({ message: '角色类型无效' }),
  }),
  companyId: z.string().optional().nullable(),
  departmentId: z.string().optional().nullable(),
});

export const userUpdateSchema = z.object({
  realName: z.string().min(1).optional(),
  email: z.string().email().optional().nullable(),
  role: z.enum(['ADMIN', 'BOSS', 'FACTORY_MANAGER', 'OPERATOR', 'WAREHOUSE_MANAGER', 'AFTERSALES', 'VIEWER']).optional(),
  departmentId: z.string().optional().nullable(),
  status: z.enum(['active', 'disabled']).optional(),
});

export const passwordResetSchema = z.object({
  newPassword: z.string().min(6, '密码至少6个字符'),
});

// ============================================================
// 产品管理
// ============================================================

export const productQuerySchema = z.object({
  search: z.string().optional(),
  category: z.string().optional(),
  materialType: z.string().optional(),
  status: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const productCreateSchema = z.object({
  sku: z.string().min(1, 'SKU不能为空'),
  name: z.string().min(1, '产品名称不能为空'),
  description: z.string().optional().nullable(),
  brand: z.string().optional().nullable(),
  category: z.string().optional().nullable(),
  materialType: z.enum(['RAW_MATERIAL', 'COMPONENT', 'SEMI_FINISHED', 'FINISHED_GOOD', 'CONSUMABLE', 'MOLD', 'SPARE_PART']).default('FINISHED_GOOD'),
  unitOfMeasureId: z.string().min(1, '单位不能为空'),
  imageUrl: z.string().url().optional().nullable(),
  status: z.enum(['active', 'inactive', 'obsolete']).default('active'),
});

export const productUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  brand: z.string().optional().nullable(),
  category: z.string().optional().nullable(),
  materialType: z.enum(['RAW_MATERIAL', 'COMPONENT', 'SEMI_FINISHED', 'FINISHED_GOOD', 'CONSUMABLE', 'MOLD', 'SPARE_PART']).optional(),
  unitOfMeasureId: z.string().optional(),
  imageUrl: z.string().url().optional().nullable(),
  status: z.enum(['active', 'inactive', 'obsolete']).optional(),
});

export const productBulkImportSchema = z.object({
  products: z.array(productCreateSchema).min(1, '至少导入一条产品数据'),
});

// ============================================================
// 公司管理
// ============================================================

export const companyQuerySchema = z.object({
  search: z.string().optional(),
  status: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const companyCreateSchema = z.object({
  code: z.string().min(1, '公司编码不能为空'),
  name: z.string().min(1, '公司名称不能为空'),
  address: z.string().optional().nullable(),
  contactPerson: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  email: z.string().email().optional().nullable(),
  currency: z.string().default('CNY'),
});

export const companyUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  address: z.string().optional().nullable(),
  contactPerson: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  email: z.string().email().optional().nullable(),
  currency: z.string().optional(),
});

// ============================================================
// 店铺管理
// ============================================================

export const storeQuerySchema = z.object({
  platformId: z.string().optional(),
  status: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const storeCreateSchema = z.object({
  platformId: z.string().min(1, '平台不能为空'),
  storeName: z.string().min(1, '店铺名称不能为空'),
  storeCode: z.string().min(1, '店铺编码不能为空'),
  marketplaceId: z.string().optional().nullable(),
  credentialsJson: z.any().optional().nullable(),
  status: z.string().default('active'),
});

export const storeUpdateSchema = z.object({
  storeName: z.string().min(1).optional(),
  storeCode: z.string().optional(),
  marketplaceId: z.string().optional().nullable(),
  credentialsJson: z.any().optional().nullable(),
  status: z.string().optional(),
});

// ============================================================
// 供应商管理
// ============================================================

export const supplierQuerySchema = z.object({
  search: z.string().optional(),
  status: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const supplierCreateSchema = z.object({
  supplierNumber: z.string().min(1, '供应商编号不能为空'),
  name: z.string().min(1, '供应商名称不能为空'),
  contactPerson: z.string().optional().nullable(),
  contactPhone: z.string().optional().nullable(),
  contactEmail: z.string().email().optional().nullable(),
  address: z.string().optional().nullable(),
  paymentTerms: z.number().int().optional().nullable(),
  currency: z.string().default('CNY'),
  status: z.string().default('active'),
});

export const supplierUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  contactPerson: z.string().optional().nullable(),
  contactPhone: z.string().optional().nullable(),
  contactEmail: z.string().email().optional().nullable(),
  address: z.string().optional().nullable(),
  paymentTerms: z.number().int().optional().nullable(),
  currency: z.string().optional(),
  status: z.string().optional(),
});

// ============================================================
// 仓库与库位管理
// ============================================================

export const warehouseSchema = z.object({
  code: z.string().min(1, '仓库编码不能为空'),
  name: z.string().min(1, '仓库名称不能为空'),
  address: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  country: z.string().optional().nullable(),
  isActive: z.boolean().default(true),
});

export const warehouseUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  address: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  country: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
});

export const storageLocationSchema = z.object({
  code: z.string().min(1, '库位编码不能为空'),
  description: z.string().optional().nullable(),
  isActive: z.boolean().default(true),
});

export const storageLocationUpdateSchema = z.object({
  code: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
});

// ============================================================
// 审计日志
// ============================================================

export const auditLogQuerySchema = z.object({
  entityType: z.string().optional(),
  entityId: z.string().optional(),
  action: z.string().optional(),
  actorId: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

// ============================================================
// 数据导出
// ============================================================

export const exportQuerySchema = z.object({
  format: z.enum(['csv', 'xlsx']).default('csv'),
  type: z.enum(['orders', 'inventory', 'profit', 'users']),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  storeId: z.string().optional(),
});

// ============================================================
// 类型导出
// ============================================================

export type UserQueryInput = z.infer<typeof userQuerySchema>;
export type UserCreateInput = z.infer<typeof userCreateSchema>;
export type UserUpdateInput = z.infer<typeof userUpdateSchema>;
export type PasswordResetInput = z.infer<typeof passwordResetSchema>;

export type ProductQueryInput = z.infer<typeof productQuerySchema>;
export type ProductCreateInput = z.infer<typeof productCreateSchema>;
export type ProductUpdateInput = z.infer<typeof productUpdateSchema>;
export type ProductBulkImportInput = z.infer<typeof productBulkImportSchema>;

export type CompanyQueryInput = z.infer<typeof companyQuerySchema>;
export type CompanyCreateInput = z.infer<typeof companyCreateSchema>;
export type CompanyUpdateInput = z.infer<typeof companyUpdateSchema>;

export type StoreQueryInput = z.infer<typeof storeQuerySchema>;
export type StoreCreateInput = z.infer<typeof storeCreateSchema>;
export type StoreUpdateInput = z.infer<typeof storeUpdateSchema>;

export type SupplierQueryInput = z.infer<typeof supplierQuerySchema>;
export type SupplierCreateInput = z.infer<typeof supplierCreateSchema>;
export type SupplierUpdateInput = z.infer<typeof supplierUpdateSchema>;

export type AuditLogQueryInput = z.infer<typeof auditLogQuerySchema>;
export type ExportQueryInput = z.infer<typeof exportQuerySchema>;
