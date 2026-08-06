import { Router, Response } from 'express';
import { authMiddleware, requireRole, AuthRequest } from '../../common/middleware';
import { success, error, paginated } from '../../common/response';
import * as s from './schemas';
import * as moldService from './services/moldService';
import * as bomService from './services/bomService';
import * as productionService from './services/productionService';
import { StatusTransitionError } from './services/productionService';
import * as costService from './services/costService';

const router = Router();

// 所有工厂操作需要认证
router.use(authMiddleware);

/** 提取路由参数 ID（Express v5 中 params 值可能是 string[]） */
function id(v: string | string[]): string {
  return Array.isArray(v) ? v[0] : v;
}

/** 统一处理 Zod 校验错误 */
function getValidationErrors(result: { success: false; error: any }) {
  return result.error.issues?.map((i: any) => `${i.path.join('.')}: ${i.message}`).join('; ');
}

/** 统一错误响应 */
function handleError(res: Response, err: any, defaultMsg: string) {
  if (err instanceof StatusTransitionError) {
    return res.status(409).json(error(err.message, 409));
  }
  if (err.code === 'P2025') {
    return res.status(404).json(error('数据不存在', 404));
  }
  if (err.code === 'P2002') {
    return res.status(409).json(error('数据冲突，唯一编号可能重复', 409));
  }
  console.error(`[Factory Error] ${defaultMsg}:`, err.message);
  return res.status(500).json(error(err.message || defaultMsg, 500));
}

// ============================================================
// 一、模具管理
// ============================================================

/** POST /api/factory/molds - 创建模具 */
router.post('/molds', requireRole('ADMIN', 'FACTORY_MANAGER'), async (req: AuthRequest, res: Response) => {
  try {
    const parsed = s.moldCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json(error(getValidationErrors(parsed), 400));
    }
    const result = await moldService.createMold(req.userId!, parsed.data);
    res.json(success(result, '模具创建成功'));
  } catch (err: any) { handleError(res, err, '创建模具失败'); }
});

/** GET /api/factory/molds - 模具列表 */
router.get('/molds', requireRole('ADMIN', 'BOSS', 'FACTORY_MANAGER'), async (req: AuthRequest, res: Response) => {
  try {
    const parsed = s.moldQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json(error(getValidationErrors(parsed), 400));
    }
    const result = await moldService.getMolds(parsed.data);
    res.json(paginated(result.data, result.total, result.page, result.pageSize));
  } catch (err: any) { handleError(res, err, '查询模具列表失败'); }
});

/** GET /api/factory/molds/:id - 模具详情 */
router.get('/molds/:id', requireRole('ADMIN', 'BOSS', 'FACTORY_MANAGER'), async (req: AuthRequest, res: Response) => {
  try {
    const result = await moldService.getMoldDetail(id(req.params.id));
    res.json(success(result, '查询成功'));
  } catch (err: any) { handleError(res, err, '查询模具详情失败'); }
});

/** PUT /api/factory/molds/:id - 更新模具 */
router.put('/molds/:id', requireRole('ADMIN', 'FACTORY_MANAGER'), async (req: AuthRequest, res: Response) => {
  try {
    const parsed = s.moldUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json(error(getValidationErrors(parsed), 400));
    }
    const result = await moldService.updateMold(id(req.params.id), parsed.data);
    res.json(success(result, '模具更新成功'));
  } catch (err: any) { handleError(res, err, '更新模具失败'); }
});

/** POST /api/factory/molds/:id/expenses - 记录模具费用 */
router.post('/molds/:id/expenses', requireRole('ADMIN', 'FACTORY_MANAGER'), async (req: AuthRequest, res: Response) => {
  try {
    const parsed = s.moldExpenseSchema.safeParse({ ...req.body, moldId: id(req.params.id) });
    if (!parsed.success) {
      return res.status(400).json(error(getValidationErrors(parsed), 400));
    }
    const result = await moldService.recordMoldExpense(req.userId!, parsed.data);
    res.json(success(result, '模具费用记录成功'));
  } catch (err: any) { handleError(res, err, '记录模具费用失败'); }
});

/** GET /api/factory/molds/:id/expense-summary - 模具费用汇总 */
router.get('/molds/:id/expense-summary', requireRole('ADMIN', 'BOSS', 'FACTORY_MANAGER'), async (req: AuthRequest, res: Response) => {
  try {
    const result = await moldService.getMoldExpenseSummary(id(req.params.id));
    res.json(success(result, '查询成功'));
  } catch (err: any) { handleError(res, err, '查询模具费用汇总失败'); }
});

/** GET /api/factory/mold-depreciations - 模具折旧记录 */
router.get('/mold-depreciations', requireRole('ADMIN', 'BOSS', 'FACTORY_MANAGER'), async (req: AuthRequest, res: Response) => {
  try {
    const parsed = s.moldDepreciationQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json(error(getValidationErrors(parsed), 400));
    }
    const result = await moldService.getMoldDepreciation(parsed.data);
    res.json(paginated(result.data, result.total, result.page, result.pageSize));
  } catch (err: any) { handleError(res, err, '查询模具折旧失败'); }
});

// ============================================================
// 二、BOM 管理
// ============================================================

/** POST /api/factory/boms - 创建 BOM */
router.post('/boms', requireRole('ADMIN', 'FACTORY_MANAGER'), async (req: AuthRequest, res: Response) => {
  try {
    const parsed = s.bomCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json(error(getValidationErrors(parsed), 400));
    }
    const result = await bomService.createBOM(req.userId!, parsed.data);
    res.json(success(result, 'BOM创建成功'));
  } catch (err: any) { handleError(res, err, '创建BOM失败'); }
});

/** GET /api/factory/boms - BOM 列表 */
router.get('/boms', requireRole('ADMIN', 'BOSS', 'FACTORY_MANAGER'), async (req: AuthRequest, res: Response) => {
  try {
    const parsed = s.bomQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json(error(getValidationErrors(parsed), 400));
    }
    const result = await bomService.getBOMList(parsed.data);
    res.json(paginated(result.data, result.total, result.page, result.pageSize));
  } catch (err: any) { handleError(res, err, '查询BOM列表失败'); }
});

/** GET /api/factory/boms/:id - BOM 详情 */
router.get('/boms/:id', requireRole('ADMIN', 'BOSS', 'FACTORY_MANAGER'), async (req: AuthRequest, res: Response) => {
  try {
    const result = await bomService.getBOMDetail(id(req.params.id));
    res.json(success(result, '查询成功'));
  } catch (err: any) { handleError(res, err, '查询BOM详情失败'); }
});

/** POST /api/factory/boms/:id/activate - 激活 BOM */
router.post('/boms/:id/activate', requireRole('ADMIN', 'FACTORY_MANAGER'), async (req: AuthRequest, res: Response) => {
  try {
    const result = await bomService.activateBOM(id(req.params.id));
    res.json(success(result, 'BOM已激活'));
  } catch (err: any) { handleError(res, err, '激活BOM失败'); }
});

/** POST /api/factory/boms/:id/copy - 复制 BOM */
router.post('/boms/:id/copy', requireRole('ADMIN', 'FACTORY_MANAGER'), async (req: AuthRequest, res: Response) => {
  try {
    const result = await bomService.copyBOM(id(req.params.id));
    res.json(success(result, 'BOM已复制为新版本'));
  } catch (err: any) { handleError(res, err, '复制BOM失败'); }
});

// ============================================================
// 三、生产工单管理
// ============================================================

/** POST /api/factory/production-orders - 创建生产工单 */
router.post('/production-orders', requireRole('ADMIN', 'FACTORY_MANAGER'), async (req: AuthRequest, res: Response) => {
  try {
    const parsed = s.productionOrderCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json(error(getValidationErrors(parsed), 400));
    }
    const result = await productionService.createProductionOrder(req.userId!, parsed.data);
    res.json(success(result, '生产工单创建成功'));
  } catch (err: any) { handleError(res, err, '创建生产工单失败'); }
});

/** GET /api/factory/production-orders - 生产工单列表 */
router.get('/production-orders', requireRole('ADMIN', 'BOSS', 'FACTORY_MANAGER'), async (req: AuthRequest, res: Response) => {
  try {
    const parsed = s.productionOrderQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json(error(getValidationErrors(parsed), 400));
    }
    const result = await productionService.getProductionOrders(parsed.data);
    res.json(paginated(result.data, result.total, result.page, result.pageSize));
  } catch (err: any) { handleError(res, err, '查询生产工单列表失败'); }
});

/** GET /api/factory/production-orders/:id - 生产工单详情 */
router.get('/production-orders/:id', requireRole('ADMIN', 'BOSS', 'FACTORY_MANAGER'), async (req: AuthRequest, res: Response) => {
  try {
    const result = await productionService.getProductionOrderDetail(id(req.params.id));
    res.json(success(result, '查询成功'));
  } catch (err: any) { handleError(res, err, '查询生产工单详情失败'); }
});

/** PUT /api/factory/production-orders/:id/status - 更新工单状态 */
router.put('/production-orders/:id/status', requireRole('ADMIN', 'FACTORY_MANAGER'), async (req: AuthRequest, res: Response) => {
  try {
    const { status } = req.body;
    if (!status) {
      return res.status(400).json(error('状态不能为空', 400));
    }
    const result = await productionService.updateStatus(id(req.params.id), status, req.userId!);
    res.json(success(result, '工单状态更新成功'));
  } catch (err: any) { handleError(res, err, '更新工单状态失败'); }
});

/** POST /api/factory/production-orders/:id/start - 开始生产 */
router.post('/production-orders/:id/start', requireRole('ADMIN', 'FACTORY_MANAGER'), async (req: AuthRequest, res: Response) => {
  try {
    const result = await productionService.startProduction(id(req.params.id));
    res.json(success(result, '生产已开始'));
  } catch (err: any) { handleError(res, err, '开始生产失败'); }
});

/** POST /api/factory/production-orders/:id/complete - 完成生产 */
router.post('/production-orders/:id/complete', requireRole('ADMIN', 'FACTORY_MANAGER'), async (req: AuthRequest, res: Response) => {
  try {
    const result = await productionService.completeProduction(id(req.params.id));
    res.json(success(result, '生产已完成'));
  } catch (err: any) { handleError(res, err, '完成生产失败'); }
});

/** POST /api/factory/production-orders/:id/release - 下达工单 */
router.post('/production-orders/:id/release', requireRole('ADMIN', 'FACTORY_MANAGER'), async (req: AuthRequest, res: Response) => {
  try {
    const result = await productionService.releaseProductionOrder(id(req.params.id));
    res.json(success(result, '工单已下达'));
  } catch (err: any) { handleError(res, err, '下达工单失败'); }
});

/** POST /api/factory/production-orders/:id/cancel - 取消工单 */
router.post('/production-orders/:id/cancel', requireRole('ADMIN', 'FACTORY_MANAGER'), async (req: AuthRequest, res: Response) => {
  try {
    const result = await productionService.cancelProductionOrder(id(req.params.id));
    res.json(success(result, '工单已取消'));
  } catch (err: any) { handleError(res, err, '取消工单失败'); }
});

/** POST /api/factory/production-orders/:id/costs - 记录生产成本 */
router.post('/production-orders/:id/costs', requireRole('ADMIN', 'FACTORY_MANAGER'), async (req: AuthRequest, res: Response) => {
  try {
    const parsed = s.productionCostSchema.safeParse({ ...req.body, productionOrderId: id(req.params.id) });
    if (!parsed.success) {
      return res.status(400).json(error(getValidationErrors(parsed), 400));
    }
    const result = await productionService.recordProductionCost(req.userId!, parsed.data);
    res.json(success(result, '生产成本记录成功'));
  } catch (err: any) { handleError(res, err, '记录生产成本失败'); }
});

// ============================================================
// 四、工厂成本核算
// ============================================================

/** GET /api/factory/costs/production-order/:id - 工单成本汇总 */
router.get('/costs/production-order/:id', requireRole('ADMIN', 'BOSS', 'FACTORY_MANAGER'), async (req: AuthRequest, res: Response) => {
  try {
    const result = await costService.getProductionCostSummary(id(req.params.id));
    res.json(success(result, '查询成功'));
  } catch (err: any) { handleError(res, err, '查询工单成本失败'); }
});

/** GET /api/factory/costs/product-breakdown - 产品成本分解 */
router.get('/costs/product-breakdown', requireRole('ADMIN', 'BOSS', 'FACTORY_MANAGER'), async (req: AuthRequest, res: Response) => {
  try {
    const parsed = s.costBreakdownQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json(error(getValidationErrors(parsed), 400));
    }
    const result = await costService.getProductCostBreakdown(
      parsed.data.productId,
      parsed.data.startDate,
      parsed.data.endDate,
    );
    res.json(success(result, '查询成功'));
  } catch (err: any) { handleError(res, err, '查询产品成本失败'); }
});

/** GET /api/factory/costs/mold-allocation/:productId - 模具成本分摊 */
router.get('/costs/mold-allocation/:productId', requireRole('ADMIN', 'BOSS', 'FACTORY_MANAGER'), async (req: AuthRequest, res: Response) => {
  try {
    const result = await costService.getMoldCostAllocation(id(req.params.productId));
    res.json(success(result, '查询成功'));
  } catch (err: any) { handleError(res, err, '查询模具分摊失败'); }
});

/** GET /api/factory/costs/overhead - 工厂固定费用汇总 */
router.get('/costs/overhead', requireRole('ADMIN', 'BOSS', 'FACTORY_MANAGER'), async (req: AuthRequest, res: Response) => {
  try {
    const parsed = s.factoryOverheadQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json(error(getValidationErrors(parsed), 400));
    }
    const result = await costService.getFactoryOverhead(parsed.data.period);
    res.json(success(result, '查询成功'));
  } catch (err: any) { handleError(res, err, '查询工厂费用失败'); }
});

// ============================================================
// 五、工厂固定费用管理
// ============================================================

/** POST /api/factory/fixed-expenses - 记录工厂固定费用 */
router.post('/fixed-expenses', requireRole('ADMIN', 'FACTORY_MANAGER'), async (req: AuthRequest, res: Response) => {
  try {
    const parsed = s.factoryExpenseSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json(error(getValidationErrors(parsed), 400));
    }
    const result = await costService.recordFactoryExpense(req.userId!, parsed.data);
    res.json(success(result, '工厂固定费用记录成功'));
  } catch (err: any) { handleError(res, err, '记录工厂费用失败'); }
});

/** GET /api/factory/fixed-expenses - 工厂固定费用列表 */
router.get('/fixed-expenses', requireRole('ADMIN', 'BOSS', 'FACTORY_MANAGER'), async (req: AuthRequest, res: Response) => {
  try {
    const page = parseInt(req.query.page as string, 10) || 1;
    const pageSize = parseInt(req.query.pageSize as string, 10) || 20;
    const result = await costService.getFactoryExpenses({
      expenseMonth: req.query.expenseMonth as string,
      expenseType: req.query.expenseType as string,
      page,
      pageSize,
    });
    res.json(paginated(result.data, result.total, result.page, result.pageSize));
  } catch (err: any) { handleError(res, err, '查询工厂费用列表失败'); }
});

export default router;
