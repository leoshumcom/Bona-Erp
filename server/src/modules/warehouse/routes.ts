import { Router, Response } from 'express';
import { authMiddleware, requireRole, AuthRequest } from '../../common/middleware';
import { success, error, paginated } from '../../common/response';
import * as s from './schemas';
import * as inventoryService from './services/inventoryService';
import { InsufficientStockError } from './services/inventoryService';

const router = Router();

// 所有仓库操作需要认证
router.use(authMiddleware);

/** 统一处理校验错误 */
function getValidationErrors(result: { success: false; error: any }) {
  return result.error.issues?.map((i: any) => `${i.path.join('.')}: ${i.message}`).join('; ');
}

/** 统一错误响应 */
function handleError(res: Response, err: any, defaultMsg: string) {
  console.error('Warehouse error:', err);
  if (err instanceof InsufficientStockError) {
    return res.status(409).json(error(`库存不足: 需要 ${err.needed}, 当前库存 ${err.onHand}`, 409));
  }
  if (err.code === 'P2025') {
    return res.status(404).json(error('关联的业务记录不存在', 404));
  }
  if (err.code === 'P2002') {
    return res.status(409).json(error('数据冲突，批次号可能重复', 409));
  }
  return res.status(500).json(error(err.message || defaultMsg, 500));
}

// ========== 入库 ==========

/** POST /api/warehouse/inbound/production - 生产入库 */
router.post('/inbound/production', requireRole('ADMIN', 'FACTORY_MANAGER', 'WAREHOUSE_MANAGER'), async (req: AuthRequest, res: Response) => {
  try {
    const parsed = s.inboundProductionSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json(error(getValidationErrors(parsed), 400));
    }
    const result = await inventoryService.inboundProduction(req.userId!, parsed.data);
    res.json(success(result, '生产入库成功'));
  } catch (err: any) { handleError(res, err, '生产入库失败'); }
});

/** POST /api/warehouse/inbound/purchase - 采购入库 */
router.post('/inbound/purchase', requireRole('ADMIN', 'WAREHOUSE_MANAGER'), async (req: AuthRequest, res: Response) => {
  try {
    const parsed = s.inboundPurchaseSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json(error(getValidationErrors(parsed), 400));
    }
    const result = await inventoryService.inboundPurchase(req.userId!, parsed.data);
    res.json(success(result, '采购入库成功'));
  } catch (err: any) { handleError(res, err, '采购入库失败'); }
});

/** POST /api/warehouse/inbound/return - 售后退货入库 */
router.post('/inbound/return', requireRole('ADMIN', 'WAREHOUSE_MANAGER', 'AFTERSALES'), async (req: AuthRequest, res: Response) => {
  try {
    const parsed = s.inboundReturnSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json(error(getValidationErrors(parsed), 400));
    }
    const result = await inventoryService.inboundReturn(req.userId!, parsed.data);
    res.json(success(result, '售后退货入库成功'));
  } catch (err: any) { handleError(res, err, '售后退货入库失败'); }
});

/** POST /api/warehouse/inbound/initial - 期初导入 */
router.post('/inbound/initial', requireRole('ADMIN', 'WAREHOUSE_MANAGER'), async (req: AuthRequest, res: Response) => {
  try {
    const parsed = s.inboundInitialSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json(error(getValidationErrors(parsed), 400));
    }
    const result = await inventoryService.inboundInitial(req.userId!, parsed.data);
    res.json(success(result, '期初库存导入成功'));
  } catch (err: any) { handleError(res, err, '期初导入失败'); }
});

// ========== 出库 ==========

/** POST /api/warehouse/outbound/issue - 生产领料 */
router.post('/outbound/issue', requireRole('ADMIN', 'FACTORY_MANAGER', 'WAREHOUSE_MANAGER'), async (req: AuthRequest, res: Response) => {
  try {
    const parsed = s.outboundIssueSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json(error(getValidationErrors(parsed), 400));
    }
    const result = await inventoryService.outboundIssue(req.userId!, parsed.data);
    res.json(success(result, '生产领料出库成功'));
  } catch (err: any) { handleError(res, err, '生产领料失败'); }
});

/** POST /api/warehouse/outbound/shipment - 销售出库 */
router.post('/outbound/shipment', requireRole('ADMIN', 'OPERATOR', 'WAREHOUSE_MANAGER'), async (req: AuthRequest, res: Response) => {
  try {
    const parsed = s.outboundShipmentSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json(error(getValidationErrors(parsed), 400));
    }
    const result = await inventoryService.outboundShipment(req.userId!, parsed.data);
    res.json(success(result, '销售出库成功'));
  } catch (err: any) { handleError(res, err, '销售出库失败'); }
});

/** POST /api/warehouse/outbound/return-stock - 退料 */
router.post('/outbound/return-stock', requireRole('ADMIN', 'FACTORY_MANAGER', 'WAREHOUSE_MANAGER'), async (req: AuthRequest, res: Response) => {
  try {
    const parsed = s.outboundReturnStockSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json(error(getValidationErrors(parsed), 400));
    }
    const result = await inventoryService.outboundReturnStock(req.userId!, parsed.data);
    res.json(success(result, '退料入库成功'));
  } catch (err: any) { handleError(res, err, '退料失败'); }
});

// ========== 盘点 ==========

/** POST /api/warehouse/count/plan - 创建盘点计划 */
router.post('/count/plan', requireRole('ADMIN', 'WAREHOUSE_MANAGER'), async (req: AuthRequest, res: Response) => {
  try {
    const parsed = s.countPlanSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json(error(getValidationErrors(parsed), 400));
    }
    const result = await inventoryService.createCountPlan(req.userId!, parsed.data);
    res.json(success(result, '盘点计划已创建'));
  } catch (err: any) { handleError(res, err, '创建盘点计划失败'); }
});

/** POST /api/warehouse/count/adjust - 盘点差异调整 */
router.post('/count/adjust', requireRole('ADMIN', 'WAREHOUSE_MANAGER'), async (req: AuthRequest, res: Response) => {
  try {
    const parsed = s.countAdjustSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json(error(getValidationErrors(parsed), 400));
    }
    const result = await inventoryService.executeCountAdjust(req.userId!, parsed.data);
    res.json(success(result, `盘点调整完成，共处理 ${result.adjustedCount} 条差异`));
  } catch (err: any) { handleError(res, err, '盘点调整失败'); }
});

// ========== 查询 ==========

/** GET /api/warehouse/balances - 库存余额查询 */
router.get('/balances', requireRole('ADMIN', 'BOSS', 'WAREHOUSE_MANAGER', 'OPERATOR', 'VIEWER'), async (req: AuthRequest, res: Response) => {
  try {
    const parsed = s.balanceQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json(error(getValidationErrors(parsed), 400));
    }
    const result = await inventoryService.getBalances(parsed.data);
    res.json(paginated(result.data, result.total, result.page, result.pageSize));
  } catch (err: any) { handleError(res, err, '查询库存失败'); }
});

/** GET /api/warehouse/ledger - 库存流水查询 */
router.get('/ledger', requireRole('ADMIN', 'BOSS', 'WAREHOUSE_MANAGER', 'VIEWER'), async (req: AuthRequest, res: Response) => {
  try {
    const parsed = s.ledgerQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json(error(getValidationErrors(parsed), 400));
    }
    const result = await inventoryService.getLedger(parsed.data);
    res.json(paginated(result.data, result.total, result.page, result.pageSize));
  } catch (err: any) { handleError(res, err, '查询流水失败'); }
});

/** GET /api/warehouse/lots - 批次查询 */
router.get('/lots', requireRole('ADMIN', 'BOSS', 'WAREHOUSE_MANAGER', 'VIEWER'), async (req: AuthRequest, res: Response) => {
  try {
    const parsed = s.lotQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json(error(getValidationErrors(parsed), 400));
    }
    const result = await inventoryService.getLots(parsed.data);
    res.json(paginated(result.data, result.total, result.page, result.pageSize));
  } catch (err: any) { handleError(res, err, '查询批次失败'); }
});

/** GET /api/warehouse/summary - 仓库汇总快照 */
router.get('/summary', requireRole('ADMIN', 'BOSS', 'WAREHOUSE_MANAGER', 'VIEWER'), async (req: AuthRequest, res: Response) => {
  try {
    const warehouseId = req.query.warehouseId as string | undefined;
    const result = await inventoryService.getWarehouseSummary(warehouseId);
    res.json(success(result, '查询成功'));
  } catch (err: any) { handleError(res, err, '查询仓库汇总失败'); }
});

export default router;
