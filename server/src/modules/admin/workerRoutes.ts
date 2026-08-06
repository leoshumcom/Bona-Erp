// @ts-nocheck
import { Hono } from 'hono';
import * as userService from './services/userService';
import * as productService from './services/productService';
import * as companyService from './services/companyService';
import * as storeService from './services/storeService';
import * as supplierService from './services/supplierService';
import * as warehouseService from './services/warehouseService';
import * as auditService from './services/auditService';
import * as exportService from './services/exportService';

export const adminRoutes = new Hono();

const SYSTEM_USER = 'system';

function handlePrismaError(err: any) {
  if (err.code === 'P2025') return { status: 404, message: '关联的业务记录不存在' };
  if (err.code === 'P2002') return { status: 409, message: '数据冲突，唯一字段重复' };
  return { status: 500, message: err.message || '服务器错误' };
}

// ============================================================
// 一、用户管理 /api/admin/users
// ============================================================

adminRoutes.get('/users', async (c) => {
  try {
    const page = parseInt(c.req.query('page') || '1');
    const pageSize = parseInt(c.req.query('pageSize') || '20');
    const result = await userService.listUsers({
      search: c.req.query('search'),
      role: c.req.query('role'),
      status: c.req.query('status'),
      page,
      pageSize,
    });
    return c.json(result);
  } catch (err: any) {
    const e = handlePrismaError(err);
    c.status(e.status); return c.json({ error: e.message });
  }
});

adminRoutes.get('/users/company/:companyId', async (c) => {
  try {
    const result = await userService.getUsersByCompany(c.req.param('companyId'));
    return c.json(result);
  } catch (err: any) {
    const e = handlePrismaError(err);
    c.status(e.status); return c.json({ error: e.message });
  }
});

adminRoutes.get('/users/role/:role', async (c) => {
  try {
    const result = await userService.getUsersByRole(c.req.param('role'));
    return c.json(result);
  } catch (err: any) {
    const e = handlePrismaError(err);
    c.status(e.status); return c.json({ error: e.message });
  }
});

adminRoutes.get('/users/:id', async (c) => {
  try {
    const result = await userService.getUser(c.req.param('id'));
    return c.json(result);
  } catch (err: any) {
    const e = handlePrismaError(err);
    c.status(e.status); return c.json({ error: e.message });
  }
});

adminRoutes.post('/users', async (c) => {
  try {
    const body = await c.req.json();
    const result = await userService.createUser(body);
    c.status(201); return c.json(result);
  } catch (err: any) {
    const e = handlePrismaError(err);
    c.status(e.status); return c.json({ error: e.message });
  }
});

adminRoutes.put('/users/:id', async (c) => {
  try {
    const body = await c.req.json();
    const result = await userService.updateUser(c.req.param('id'), body, SYSTEM_USER);
    return c.json(result);
  } catch (err: any) {
    const e = handlePrismaError(err);
    c.status(e.status); return c.json({ error: e.message });
  }
});

adminRoutes.delete('/users/:id', async (c) => {
  try {
    const result = await userService.deleteUser(c.req.param('id'));
    return c.json(result);
  } catch (err: any) {
    const e = handlePrismaError(err);
    c.status(e.status); return c.json({ error: e.message });
  }
});

adminRoutes.post('/users/:id/reset-password', async (c) => {
  try {
    const body = await c.req.json();
    const result = await userService.resetPassword(c.req.param('id'), body.newPassword);
    return c.json(result);
  } catch (err: any) {
    const e = handlePrismaError(err);
    c.status(e.status); return c.json({ error: e.message });
  }
});

// ============================================================
// 二、产品管理 /api/admin/products
// ============================================================

adminRoutes.get('/products', async (c) => {
  try {
    const page = parseInt(c.req.query('page') || '1');
    const pageSize = parseInt(c.req.query('pageSize') || '20');
    const result = await productService.listProducts({
      search: c.req.query('search'),
      category: c.req.query('category'),
      materialType: c.req.query('materialType'),
      status: c.req.query('status'),
      page,
      pageSize,
    });
    return c.json(result);
  } catch (err: any) {
    const e = handlePrismaError(err);
    c.status(e.status); return c.json({ error: e.message });
  }
});

adminRoutes.get('/products/:id', async (c) => {
  try {
    const result = await productService.getProduct(c.req.param('id'));
    return c.json(result);
  } catch (err: any) {
    const e = handlePrismaError(err);
    c.status(e.status); return c.json({ error: e.message });
  }
});

adminRoutes.get('/products/:id/stats', async (c) => {
  try {
    const result = await productService.getProductStats(c.req.param('id'));
    return c.json(result);
  } catch (err: any) {
    const e = handlePrismaError(err);
    c.status(e.status); return c.json({ error: e.message });
  }
});

adminRoutes.post('/products', async (c) => {
  try {
    const body = await c.req.json();
    const result = await productService.createProduct(body);
    c.status(201); return c.json(result);
  } catch (err: any) {
    const e = handlePrismaError(err);
    c.status(e.status); return c.json({ error: e.message });
  }
});

adminRoutes.put('/products/:id', async (c) => {
  try {
    const body = await c.req.json();
    const result = await productService.updateProduct(c.req.param('id'), body);
    return c.json(result);
  } catch (err: any) {
    const e = handlePrismaError(err);
    c.status(e.status); return c.json({ error: e.message });
  }
});

adminRoutes.delete('/products/:id', async (c) => {
  try {
    const result = await productService.deleteProduct(c.req.param('id'));
    return c.json(result);
  } catch (err: any) {
    const e = handlePrismaError(err);
    c.status(e.status); return c.json({ error: e.message });
  }
});

adminRoutes.post('/products/bulk-import', async (c) => {
  try {
    const body = await c.req.json();
    const result = await productService.bulkImport(body.products);
    c.status(201); return c.json(result);
  } catch (err: any) {
    const e = handlePrismaError(err);
    c.status(e.status); return c.json({ error: e.message });
  }
});

// ============================================================
// 三、公司管理 /api/admin/companies
// ============================================================

adminRoutes.get('/companies', async (c) => {
  try {
    const page = parseInt(c.req.query('page') || '1');
    const pageSize = parseInt(c.req.query('pageSize') || '20');
    const result = await companyService.listCompanies({
      search: c.req.query('search'),
      page,
      pageSize,
    });
    return c.json(result);
  } catch (err: any) {
    const e = handlePrismaError(err);
    c.status(e.status); return c.json({ error: e.message });
  }
});

adminRoutes.get('/companies/:id', async (c) => {
  try {
    const result = await companyService.getCompany(c.req.param('id'));
    return c.json(result);
  } catch (err: any) {
    const e = handlePrismaError(err);
    c.status(e.status); return c.json({ error: e.message });
  }
});

adminRoutes.post('/companies', async (c) => {
  try {
    const body = await c.req.json();
    const result = await companyService.createCompany(body);
    c.status(201); return c.json(result);
  } catch (err: any) {
    const e = handlePrismaError(err);
    c.status(e.status); return c.json({ error: e.message });
  }
});

adminRoutes.put('/companies/:id', async (c) => {
  try {
    const body = await c.req.json();
    const result = await companyService.updateCompany(c.req.param('id'), body);
    return c.json(result);
  } catch (err: any) {
    const e = handlePrismaError(err);
    c.status(e.status); return c.json({ error: e.message });
  }
});

adminRoutes.delete('/companies/:id', async (c) => {
  try {
    const result = await companyService.deleteCompany(c.req.param('id'));
    return c.json(result);
  } catch (err: any) {
    const e = handlePrismaError(err);
    c.status(e.status); return c.json({ error: e.message });
  }
});

// ============================================================
// 四、店铺管理 /api/admin/stores
// ============================================================

adminRoutes.get('/stores', async (c) => {
  try {
    const page = parseInt(c.req.query('page') || '1');
    const pageSize = parseInt(c.req.query('pageSize') || '20');
    const result = await storeService.listStores({
      platformId: c.req.query('platformId'),
      status: c.req.query('status'),
      page,
      pageSize,
    });
    return c.json(result);
  } catch (err: any) {
    const e = handlePrismaError(err);
    c.status(e.status); return c.json({ error: e.message });
  }
});

adminRoutes.get('/stores/:id', async (c) => {
  try {
    const result = await storeService.getStore(c.req.param('id'));
    return c.json(result);
  } catch (err: any) {
    const e = handlePrismaError(err);
    c.status(e.status); return c.json({ error: e.message });
  }
});

adminRoutes.post('/stores', async (c) => {
  try {
    const body = await c.req.json();
    const result = await storeService.createStore(body);
    c.status(201); return c.json(result);
  } catch (err: any) {
    const e = handlePrismaError(err);
    c.status(e.status); return c.json({ error: e.message });
  }
});

adminRoutes.put('/stores/:id', async (c) => {
  try {
    const body = await c.req.json();
    const result = await storeService.updateStore(c.req.param('id'), body);
    return c.json(result);
  } catch (err: any) {
    const e = handlePrismaError(err);
    c.status(e.status); return c.json({ error: e.message });
  }
});

adminRoutes.delete('/stores/:id', async (c) => {
  try {
    const result = await storeService.deleteStore(c.req.param('id'));
    return c.json(result);
  } catch (err: any) {
    const e = handlePrismaError(err);
    c.status(e.status); return c.json({ error: e.message });
  }
});

// ============================================================
// 五、供应商管理 /api/admin/suppliers
// ============================================================

adminRoutes.get('/suppliers', async (c) => {
  try {
    const page = parseInt(c.req.query('page') || '1');
    const pageSize = parseInt(c.req.query('pageSize') || '20');
    const result = await supplierService.listSuppliers({
      search: c.req.query('search'),
      status: c.req.query('status'),
      page,
      pageSize,
    });
    return c.json(result);
  } catch (err: any) {
    const e = handlePrismaError(err);
    c.status(e.status); return c.json({ error: e.message });
  }
});

adminRoutes.get('/suppliers/:id', async (c) => {
  try {
    const result = await supplierService.getSupplier(c.req.param('id'));
    return c.json(result);
  } catch (err: any) {
    const e = handlePrismaError(err);
    c.status(e.status); return c.json({ error: e.message });
  }
});

adminRoutes.post('/suppliers', async (c) => {
  try {
    const body = await c.req.json();
    const result = await supplierService.createSupplier(body);
    c.status(201); return c.json(result);
  } catch (err: any) {
    const e = handlePrismaError(err);
    c.status(e.status); return c.json({ error: e.message });
  }
});

adminRoutes.put('/suppliers/:id', async (c) => {
  try {
    const body = await c.req.json();
    const result = await supplierService.updateSupplier(c.req.param('id'), body);
    return c.json(result);
  } catch (err: any) {
    const e = handlePrismaError(err);
    c.status(e.status); return c.json({ error: e.message });
  }
});

adminRoutes.delete('/suppliers/:id', async (c) => {
  try {
    const result = await supplierService.deleteSupplier(c.req.param('id'));
    return c.json(result);
  } catch (err: any) {
    const e = handlePrismaError(err);
    c.status(e.status); return c.json({ error: e.message });
  }
});

// ============================================================
// 六、仓库管理 /api/admin/warehouses
// ============================================================

adminRoutes.get('/warehouses', async (c) => {
  try {
    const page = parseInt(c.req.query('page') || '1');
    const pageSize = parseInt(c.req.query('pageSize') || '20');
    const result = await warehouseService.listWarehouses({
      search: c.req.query('search'),
      page,
      pageSize,
    });
    return c.json(result);
  } catch (err: any) {
    const e = handlePrismaError(err);
    c.status(e.status); return c.json({ error: e.message });
  }
});

adminRoutes.get('/warehouses/:id', async (c) => {
  try {
    const result = await warehouseService.getWarehouse(c.req.param('id'));
    return c.json(result);
  } catch (err: any) {
    const e = handlePrismaError(err);
    c.status(e.status); return c.json({ error: e.message });
  }
});

adminRoutes.get('/warehouses/:id/full', async (c) => {
  try {
    const result = await warehouseService.getWarehouseWithLocations(c.req.param('id'));
    return c.json(result);
  } catch (err: any) {
    const e = handlePrismaError(err);
    c.status(e.status); return c.json({ error: e.message });
  }
});

adminRoutes.post('/warehouses', async (c) => {
  try {
    const body = await c.req.json();
    const result = await warehouseService.createWarehouse(body);
    c.status(201); return c.json(result);
  } catch (err: any) {
    const e = handlePrismaError(err);
    c.status(e.status); return c.json({ error: e.message });
  }
});

adminRoutes.put('/warehouses/:id', async (c) => {
  try {
    const body = await c.req.json();
    const result = await warehouseService.updateWarehouse(c.req.param('id'), body);
    return c.json(result);
  } catch (err: any) {
    const e = handlePrismaError(err);
    c.status(e.status); return c.json({ error: e.message });
  }
});

adminRoutes.delete('/warehouses/:id', async (c) => {
  try {
    const result = await warehouseService.deleteWarehouse(c.req.param('id'));
    return c.json(result);
  } catch (err: any) {
    const e = handlePrismaError(err);
    c.status(e.status); return c.json({ error: e.message });
  }
});

// ============================================================
// 七、库位管理 /api/admin/warehouses/:id/locations
// ============================================================

adminRoutes.get('/warehouses/:id/locations', async (c) => {
  try {
    const result = await warehouseService.listStorageLocations(c.req.param('id'));
    return c.json(result);
  } catch (err: any) {
    const e = handlePrismaError(err);
    c.status(e.status); return c.json({ error: e.message });
  }
});

adminRoutes.post('/warehouses/:id/locations', async (c) => {
  try {
    const body = await c.req.json();
    const result = await warehouseService.createStorageLocation({
      ...body,
      warehouseId: c.req.param('id'),
    });
    c.status(201); return c.json(result);
  } catch (err: any) {
    const e = handlePrismaError(err);
    c.status(e.status); return c.json({ error: e.message });
  }
});

adminRoutes.get('/warehouses/:id/locations/:locationId', async (c) => {
  try {
    const result = await warehouseService.getStorageLocation(c.req.param('locationId'));
    return c.json(result);
  } catch (err: any) {
    const e = handlePrismaError(err);
    c.status(e.status); return c.json({ error: e.message });
  }
});

adminRoutes.put('/warehouses/:id/locations/:locationId', async (c) => {
  try {
    const body = await c.req.json();
    const result = await warehouseService.updateStorageLocation(c.req.param('locationId'), body);
    return c.json(result);
  } catch (err: any) {
    const e = handlePrismaError(err);
    c.status(e.status); return c.json({ error: e.message });
  }
});

adminRoutes.delete('/warehouses/:id/locations/:locationId', async (c) => {
  try {
    const result = await warehouseService.deleteStorageLocation(c.req.param('locationId'));
    return c.json(result);
  } catch (err: any) {
    const e = handlePrismaError(err);
    c.status(e.status); return c.json({ error: e.message });
  }
});

// ============================================================
// 八、审计日志 /api/admin/audit-logs
// ============================================================

adminRoutes.get('/audit-logs', async (c) => {
  try {
    const page = parseInt(c.req.query('page') || '1');
    const pageSize = parseInt(c.req.query('pageSize') || '20');
    const result = await auditService.getAuditLogs({
      entityType: c.req.query('entityType'),
      entityId: c.req.query('entityId'),
      action: c.req.query('action'),
      actorId: c.req.query('actorId'),
      startDate: c.req.query('startDate'),
      endDate: c.req.query('endDate'),
      page,
      pageSize,
    });
    return c.json(result);
  } catch (err: any) {
    const e = handlePrismaError(err);
    c.status(e.status); return c.json({ error: e.message });
  }
});

adminRoutes.get('/audit-logs/:id', async (c) => {
  try {
    const result = await auditService.getAuditLogDetail(c.req.param('id'));
    return c.json(result);
  } catch (err: any) {
    const e = handlePrismaError(err);
    c.status(e.status); return c.json({ error: e.message });
  }
});

adminRoutes.get('/audit-logs/user/:userId/activity', async (c) => {
  try {
    const result = await auditService.getUserActivity(
      c.req.param('userId'),
      c.req.query('startDate'),
      c.req.query('endDate'),
    );
    return c.json(result);
  } catch (err: any) {
    const e = handlePrismaError(err);
    c.status(e.status); return c.json({ error: e.message });
  }
});

// ============================================================
// 九、数据导出 /api/admin/export
// ============================================================

adminRoutes.get('/export', async (c) => {
  try {
    const type = c.req.query('type');
    const startDate = c.req.query('startDate');
    const endDate = c.req.query('endDate');
    const storeId = c.req.query('storeId');

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
        return c.json({ error: '不支持的导出类型' }, 400);
    }

    c.header('Content-Type', 'text/csv; charset=utf-8');
    c.header('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
    return c.body(csvData);
  } catch (err: any) {
    const e = handlePrismaError(err);
    c.status(e.status); return c.json({ error: e.message });
  }
});

export default adminRoutes;
