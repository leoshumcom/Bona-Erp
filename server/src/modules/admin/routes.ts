import { Router, Response } from 'express';
import { authMiddleware, requireRole, AuthRequest } from '../../common/middleware';
import { success, error, paginated } from '../../common/response';
import * as s from './schemas';

import * as userService from './services/userService';
import * as productService from './services/productService';
import * as companyService from './services/companyService';
import * as storeService from './services/storeService';
import * as supplierService from './services/supplierService';
import * as warehouseService from './services/warehouseService';
import * as auditService from './services/auditService';
import * as exportService from './services/exportService';

const router = Router();

// 所有管理路由需要认证 + ADMIN角色
router.use(authMiddleware);
router.use(requireRole('ADMIN'));

// ============================================================
// 工具函数
// ============================================================

/** 提取路由参数 ID（兼容 Express v5 中的 string[] 返回值） */
function id(v: string | string[]): string {
  return Array.isArray(v) ? v[0] : v;
}

/** 统一处理 Zod 校验错误 */
function getValidationErrors(result: { success: false; error: any }) {
  return result.error.issues?.map((i: any) => `${i.path.join('.')}: ${i.message}`).join('; ');
}

/** 统一错误响应 */
function handleError(res: Response, err: any, defaultMsg: string) {
  if (err.code === 'P2025') {
    return res.status(404).json(error('数据不存在或已被删除', 404));
  }
  if (err.code === 'P2002') {
    return res.status(409).json(error('数据冲突，唯一编码或唯一字段重复', 409));
  }
  console.error(`[Admin Error] ${defaultMsg}:`, err.message);
  return res.status(500).json(error(err.message || defaultMsg, 500));
}

// ============================================================
// 一、用户管理 /api/admin/users
// ============================================================

/** GET /api/admin/users - 用户列表 */
router.get('/users', async (req: AuthRequest, res: Response) => {
  try {
    const parsed = s.userQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json(error(getValidationErrors(parsed), 400));
    }
    const result = await userService.listUsers(parsed.data);
    res.json(paginated(result.data, result.total, result.page, result.pageSize));
  } catch (err: any) { handleError(res, err, '查询用户列表失败'); }
});

/** GET /api/admin/users/company/:companyId - 按公司查询用户 */
router.get('/users/company/:companyId', async (req: AuthRequest, res: Response) => {
  try {
    const users = await userService.getUsersByCompany(id(req.params.companyId));
    res.json(success(users, '查询成功'));
  } catch (err: any) { handleError(res, err, '查询公司用户失败'); }
});

/** GET /api/admin/users/role/:role - 按角色查询用户 */
router.get('/users/role/:role', async (req: AuthRequest, res: Response) => {
  try {
    const users = await userService.getUsersByRole(id(req.params.role));
    res.json(success(users, '查询成功'));
  } catch (err: any) { handleError(res, err, '查询角色用户失败'); }
});

/** GET /api/admin/users/:id - 用户详情 */
router.get('/users/:id', async (req: AuthRequest, res: Response) => {
  try {
    const user = await userService.getUser(id(req.params.id));
    res.json(success(user, '查询成功'));
  } catch (err: any) { handleError(res, err, '查询用户详情失败'); }
});

/** POST /api/admin/users - 创建用户 */
router.post('/users', async (req: AuthRequest, res: Response) => {
  try {
    const parsed = s.userCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json(error(getValidationErrors(parsed), 400));
    }
    const user = await userService.createUser(parsed.data);
    res.status(201).json(success(user, '用户创建成功'));
  } catch (err: any) { handleError(res, err, '创建用户失败'); }
});

/** PUT /api/admin/users/:id - 更新用户 */
router.put('/users/:id', async (req: AuthRequest, res: Response) => {
  try {
    const parsed = s.userUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json(error(getValidationErrors(parsed), 400));
    }
    const user = await userService.updateUser(id(req.params.id), parsed.data, req.userId);
    res.json(success(user, '用户更新成功'));
  } catch (err: any) { handleError(res, err, '更新用户失败'); }
});

/** DELETE /api/admin/users/:id - 软删除用户 */
router.delete('/users/:id', async (req: AuthRequest, res: Response) => {
  try {
    const result = await userService.deleteUser(id(req.params.id));
    res.json(success(result, '用户已禁用'));
  } catch (err: any) { handleError(res, err, '删除用户失败'); }
});

/** POST /api/admin/users/:id/reset-password - 重置密码 */
router.post('/users/:id/reset-password', async (req: AuthRequest, res: Response) => {
  try {
    const parsed = s.passwordResetSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json(error(getValidationErrors(parsed), 400));
    }
    const result = await userService.resetPassword(id(req.params.id), parsed.data.newPassword);
    res.json(success(result, '密码重置成功'));
  } catch (err: any) { handleError(res, err, '重置密码失败'); }
});

// ============================================================
// 二、产品管理 /api/admin/products
// ============================================================

/** GET /api/admin/products - 产品列表 */
router.get('/products', async (req: AuthRequest, res: Response) => {
  try {
    const parsed = s.productQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json(error(getValidationErrors(parsed), 400));
    }
    const result = await productService.listProducts(parsed.data);
    res.json(paginated(result.data, result.total, result.page, result.pageSize));
  } catch (err: any) { handleError(res, err, '查询产品列表失败'); }
});

/** GET /api/admin/products/:id - 产品详情 */
router.get('/products/:id', async (req: AuthRequest, res: Response) => {
  try {
    const product = await productService.getProduct(id(req.params.id));
    res.json(success(product, '查询成功'));
  } catch (err: any) { handleError(res, err, '查询产品详情失败'); }
});

/** GET /api/admin/products/:id/stats - 产品统计 */
router.get('/products/:id/stats', async (req: AuthRequest, res: Response) => {
  try {
    const stats = await productService.getProductStats(id(req.params.id));
    res.json(success(stats, '查询成功'));
  } catch (err: any) { handleError(res, err, '查询产品统计失败'); }
});

/** POST /api/admin/products - 创建产品 */
router.post('/products', async (req: AuthRequest, res: Response) => {
  try {
    const parsed = s.productCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json(error(getValidationErrors(parsed), 400));
    }
    const product = await productService.createProduct(parsed.data);
    res.status(201).json(success(product, '产品创建成功'));
  } catch (err: any) { handleError(res, err, '创建产品失败'); }
});

/** PUT /api/admin/products/:id - 更新产品 */
router.put('/products/:id', async (req: AuthRequest, res: Response) => {
  try {
    const parsed = s.productUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json(error(getValidationErrors(parsed), 400));
    }
    const product = await productService.updateProduct(id(req.params.id), parsed.data);
    res.json(success(product, '产品更新成功'));
  } catch (err: any) { handleError(res, err, '更新产品失败'); }
});

/** DELETE /api/admin/products/:id - 删除产品 */
router.delete('/products/:id', async (req: AuthRequest, res: Response) => {
  try {
    const result = await productService.deleteProduct(id(req.params.id));
    res.json(success(result, '产品已删除'));
  } catch (err: any) { handleError(res, err, '删除产品失败'); }
});

/** POST /api/admin/products/bulk-import - 批量导入产品 */
router.post('/products/bulk-import', async (req: AuthRequest, res: Response) => {
  try {
    const parsed = s.productBulkImportSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json(error(getValidationErrors(parsed), 400));
    }
    const result = await productService.bulkImport(parsed.data.products);
    res.status(201).json(success(result, `导入完成: 成功 ${result.successCount}, 失败 ${result.failCount}`));
  } catch (err: any) { handleError(res, err, '批量导入产品失败'); }
});

// ============================================================
// 三、公司管理 /api/admin/companies
// ============================================================

/** GET /api/admin/companies - 公司列表 */
router.get('/companies', async (req: AuthRequest, res: Response) => {
  try {
    const parsed = s.companyQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json(error(getValidationErrors(parsed), 400));
    }
    const result = await companyService.listCompanies(parsed.data);
    res.json(paginated(result.data, result.total, result.page, result.pageSize));
  } catch (err: any) { handleError(res, err, '查询公司列表失败'); }
});

/** GET /api/admin/companies/:id - 公司详情 */
router.get('/companies/:id', async (req: AuthRequest, res: Response) => {
  try {
    const company = await companyService.getCompany(id(req.params.id));
    res.json(success(company, '查询成功'));
  } catch (err: any) { handleError(res, err, '查询公司详情失败'); }
});

/** POST /api/admin/companies - 创建公司 */
router.post('/companies', async (req: AuthRequest, res: Response) => {
  try {
    const parsed = s.companyCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json(error(getValidationErrors(parsed), 400));
    }
    const company = await companyService.createCompany(parsed.data);
    res.status(201).json(success(company, '公司创建成功'));
  } catch (err: any) { handleError(res, err, '创建公司失败'); }
});

/** PUT /api/admin/companies/:id - 更新公司 */
router.put('/companies/:id', async (req: AuthRequest, res: Response) => {
  try {
    const parsed = s.companyUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json(error(getValidationErrors(parsed), 400));
    }
    const company = await companyService.updateCompany(id(req.params.id), parsed.data);
    res.json(success(company, '公司更新成功'));
  } catch (err: any) { handleError(res, err, '更新公司失败'); }
});

/** DELETE /api/admin/companies/:id - 删除公司 */
router.delete('/companies/:id', async (req: AuthRequest, res: Response) => {
  try {
    const result = await companyService.deleteCompany(id(req.params.id));
    res.json(success(result, '公司已删除'));
  } catch (err: any) { handleError(res, err, '删除公司失败'); }
});

// ============================================================
// 四、店铺管理 /api/admin/stores
// ============================================================

/** GET /api/admin/stores - 店铺列表 */
router.get('/stores', async (req: AuthRequest, res: Response) => {
  try {
    const parsed = s.storeQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json(error(getValidationErrors(parsed), 400));
    }
    const result = await storeService.listStores(parsed.data);
    res.json(paginated(result.data, result.total, result.page, result.pageSize));
  } catch (err: any) { handleError(res, err, '查询店铺列表失败'); }
});

/** GET /api/admin/stores/:id - 店铺详情 */
router.get('/stores/:id', async (req: AuthRequest, res: Response) => {
  try {
    const store = await storeService.getStore(id(req.params.id));
    res.json(success(store, '查询成功'));
  } catch (err: any) { handleError(res, err, '查询店铺详情失败'); }
});

/** POST /api/admin/stores - 创建店铺 */
router.post('/stores', async (req: AuthRequest, res: Response) => {
  try {
    const parsed = s.storeCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json(error(getValidationErrors(parsed), 400));
    }
    const store = await storeService.createStore(parsed.data);
    res.status(201).json(success(store, '店铺创建成功'));
  } catch (err: any) { handleError(res, err, '创建店铺失败'); }
});

/** PUT /api/admin/stores/:id - 更新店铺 */
router.put('/stores/:id', async (req: AuthRequest, res: Response) => {
  try {
    const parsed = s.storeUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json(error(getValidationErrors(parsed), 400));
    }
    const store = await storeService.updateStore(id(req.params.id), parsed.data);
    res.json(success(store, '店铺更新成功'));
  } catch (err: any) { handleError(res, err, '更新店铺失败'); }
});

/** DELETE /api/admin/stores/:id - 软删除店铺 */
router.delete('/stores/:id', async (req: AuthRequest, res: Response) => {
  try {
    const result = await storeService.deleteStore(id(req.params.id));
    res.json(success(result, '店铺已停用'));
  } catch (err: any) { handleError(res, err, '删除店铺失败'); }
});

// ============================================================
// 五、供应商管理 /api/admin/suppliers
// ============================================================

/** GET /api/admin/suppliers - 供应商列表 */
router.get('/suppliers', async (req: AuthRequest, res: Response) => {
  try {
    const parsed = s.supplierQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json(error(getValidationErrors(parsed), 400));
    }
    const result = await supplierService.listSuppliers(parsed.data);
    res.json(paginated(result.data, result.total, result.page, result.pageSize));
  } catch (err: any) { handleError(res, err, '查询供应商列表失败'); }
});

/** GET /api/admin/suppliers/:id - 供应商详情 */
router.get('/suppliers/:id', async (req: AuthRequest, res: Response) => {
  try {
    const supplier = await supplierService.getSupplier(id(req.params.id));
    res.json(success(supplier, '查询成功'));
  } catch (err: any) { handleError(res, err, '查询供应商详情失败'); }
});

/** POST /api/admin/suppliers - 创建供应商 */
router.post('/suppliers', async (req: AuthRequest, res: Response) => {
  try {
    const parsed = s.supplierCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json(error(getValidationErrors(parsed), 400));
    }
    const supplier = await supplierService.createSupplier(parsed.data);
    res.status(201).json(success(supplier, '供应商创建成功'));
  } catch (err: any) { handleError(res, err, '创建供应商失败'); }
});

/** PUT /api/admin/suppliers/:id - 更新供应商 */
router.put('/suppliers/:id', async (req: AuthRequest, res: Response) => {
  try {
    const parsed = s.supplierUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json(error(getValidationErrors(parsed), 400));
    }
    const supplier = await supplierService.updateSupplier(id(req.params.id), parsed.data);
    res.json(success(supplier, '供应商更新成功'));
  } catch (err: any) { handleError(res, err, '更新供应商失败'); }
});

/** DELETE /api/admin/suppliers/:id - 软删除供应商 */
router.delete('/suppliers/:id', async (req: AuthRequest, res: Response) => {
  try {
    const result = await supplierService.deleteSupplier(id(req.params.id));
    res.json(success(result, '供应商已停用'));
  } catch (err: any) { handleError(res, err, '删除供应商失败'); }
});

// ============================================================
// 六、仓库管理 /api/admin/warehouses
// ============================================================

/** GET /api/admin/warehouses - 仓库列表 */
router.get('/warehouses', async (req: AuthRequest, res: Response) => {
  try {
    const page = parseInt(req.query.page as string, 10) || 1;
    const pageSize = parseInt(req.query.pageSize as string, 10) || 20;
    const search = req.query.search as string | undefined;
    const result = await warehouseService.listWarehouses({ search, page, pageSize });
    res.json(paginated(result.data, result.total, result.page, result.pageSize));
  } catch (err: any) { handleError(res, err, '查询仓库列表失败'); }
});

/** GET /api/admin/warehouses/:id - 仓库详情 */
router.get('/warehouses/:id', async (req: AuthRequest, res: Response) => {
  try {
    const warehouse = await warehouseService.getWarehouse(id(req.params.id));
    res.json(success(warehouse, '查询成功'));
  } catch (err: any) { handleError(res, err, '查询仓库详情失败'); }
});

/** GET /api/admin/warehouses/:id/full - 仓库详情（含库位+库存汇总） */
router.get('/warehouses/:id/full', async (req: AuthRequest, res: Response) => {
  try {
    const warehouse = await warehouseService.getWarehouseWithLocations(id(req.params.id));
    res.json(success(warehouse, '查询成功'));
  } catch (err: any) { handleError(res, err, '查询仓库详情失败'); }
});

/** POST /api/admin/warehouses - 创建仓库 */
router.post('/warehouses', async (req: AuthRequest, res: Response) => {
  try {
    const parsed = s.warehouseSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json(error(getValidationErrors(parsed), 400));
    }
    const warehouse = await warehouseService.createWarehouse(parsed.data);
    res.status(201).json(success(warehouse, '仓库创建成功'));
  } catch (err: any) { handleError(res, err, '创建仓库失败'); }
});

/** PUT /api/admin/warehouses/:id - 更新仓库 */
router.put('/warehouses/:id', async (req: AuthRequest, res: Response) => {
  try {
    const parsed = s.warehouseUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json(error(getValidationErrors(parsed), 400));
    }
    const warehouse = await warehouseService.updateWarehouse(id(req.params.id), parsed.data);
    res.json(success(warehouse, '仓库更新成功'));
  } catch (err: any) { handleError(res, err, '更新仓库失败'); }
});

/** DELETE /api/admin/warehouses/:id - 删除仓库 */
router.delete('/warehouses/:id', async (req: AuthRequest, res: Response) => {
  try {
    const result = await warehouseService.deleteWarehouse(id(req.params.id));
    res.json(success(result, '仓库已删除'));
  } catch (err: any) { handleError(res, err, '删除仓库失败'); }
});

// ============================================================
// 七、库位管理 /api/admin/warehouses/:id/locations
// ============================================================

/** GET /api/admin/warehouses/:id/locations - 仓库库位列表 */
router.get('/warehouses/:id/locations', async (req: AuthRequest, res: Response) => {
  try {
    const locations = await warehouseService.listStorageLocations(id(req.params.id));
    res.json(success(locations, '查询成功'));
  } catch (err: any) { handleError(res, err, '查询库位列表失败'); }
});

/** POST /api/admin/warehouses/:id/locations - 创建库位 */
router.post('/warehouses/:id/locations', async (req: AuthRequest, res: Response) => {
  try {
    const parsed = s.storageLocationSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json(error(getValidationErrors(parsed), 400));
    }
    const location = await warehouseService.createStorageLocation({
      ...parsed.data,
      warehouseId: id(req.params.id),
    });
    res.status(201).json(success(location, '库位创建成功'));
  } catch (err: any) { handleError(res, err, '创建库位失败'); }
});

/** GET /api/admin/warehouses/:id/locations/:locationId - 库位详情 */
router.get('/warehouses/:id/locations/:locationId', async (req: AuthRequest, res: Response) => {
  try {
    const location = await warehouseService.getStorageLocation(id(req.params.locationId));
    res.json(success(location, '查询成功'));
  } catch (err: any) { handleError(res, err, '查询库位详情失败'); }
});

/** PUT /api/admin/warehouses/:id/locations/:locationId - 更新库位 */
router.put('/warehouses/:id/locations/:locationId', async (req: AuthRequest, res: Response) => {
  try {
    const parsed = s.storageLocationUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json(error(getValidationErrors(parsed), 400));
    }
    const location = await warehouseService.updateStorageLocation(id(req.params.locationId), parsed.data);
    res.json(success(location, '库位更新成功'));
  } catch (err: any) { handleError(res, err, '更新库位失败'); }
});

/** DELETE /api/admin/warehouses/:id/locations/:locationId - 删除库位 */
router.delete('/warehouses/:id/locations/:locationId', async (req: AuthRequest, res: Response) => {
  try {
    const result = await warehouseService.deleteStorageLocation(id(req.params.locationId));
    res.json(success(result, '库位已删除'));
  } catch (err: any) { handleError(res, err, '删除库位失败'); }
});

// ============================================================
// 八、审计日志 /api/admin/audit-logs
// ============================================================

/** GET /api/admin/audit-logs - 审计日志列表 */
router.get('/audit-logs', async (req: AuthRequest, res: Response) => {
  try {
    const parsed = s.auditLogQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json(error(getValidationErrors(parsed), 400));
    }
    const result = await auditService.getAuditLogs(parsed.data);
    res.json(paginated(result.data, result.total, result.page, result.pageSize));
  } catch (err: any) { handleError(res, err, '查询审计日志失败'); }
});

/** GET /api/admin/audit-logs/:id - 审计日志详情 */
router.get('/audit-logs/:id', async (req: AuthRequest, res: Response) => {
  try {
    const log = await auditService.getAuditLogDetail(id(req.params.id));
    res.json(success(log, '查询成功'));
  } catch (err: any) { handleError(res, err, '查询审计日志详情失败'); }
});

/** GET /api/admin/audit-logs/user/:userId/activity - 用户活动记录 */
router.get('/audit-logs/user/:userId/activity', async (req: AuthRequest, res: Response) => {
  try {
    const activity = await auditService.getUserActivity(
      id(req.params.userId),
      req.query.startDate as string | undefined,
      req.query.endDate as string | undefined,
    );
    res.json(success(activity, '查询成功'));
  } catch (err: any) { handleError(res, err, '查询用户活动失败'); }
});

// ============================================================
// 九、数据导出 /api/admin/export
// ============================================================

/** GET /api/admin/export - 数据导出 */
router.get('/export', async (req: AuthRequest, res: Response) => {
  try {
    const parsed = s.exportQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json(error(getValidationErrors(parsed), 400));
    }

    const { type, startDate, endDate, storeId } = parsed.data;
    let csvData: string;
    let filename: string;

    switch (type) {
      case 'orders':
        csvData = await exportService.exportOrders({ startDate, endDate, storeId });
        filename = '订单导出.csv';
        break;
      case 'inventory':
        csvData = await exportService.exportInventory();
        filename = '库存导出.csv';
        break;
      case 'profit':
        csvData = await exportService.exportProfit({ startDate, endDate, storeId });
        filename = '利润导出.csv';
        break;
      case 'users':
        csvData = await exportService.exportUsers();
        filename = '用户导出.csv';
        break;
      default:
        return res.status(400).json(error('不支持的导出类型', 400));
    }

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
    res.send(csvData);
  } catch (err: any) { handleError(res, err, '数据导出失败'); }
});

export default router;
