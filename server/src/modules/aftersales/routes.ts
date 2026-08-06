import { Router, Response } from 'express';
import { authMiddleware, requireRole, AuthRequest } from '../../common/middleware';
import { success, error, paginated } from '../../common/response';
import * as s from './schemas';
import * as aftersalesService from './services/aftersalesService';
import * as logisticsService from './services/logisticsService';

const router = Router();

// 所有售后操作需要认证
router.use(authMiddleware);

// ============================================================
// 工具函数
// ============================================================

/** 统一处理 Zod 校验错误 */
function getValidationErrors(result: { success: false; error: any }) {
  return result.error.issues?.map((i: any) => `${i.path.join('.')}: ${i.message}`).join('; ') || '请求参数无效';
}

/** 统一错误响应 */
function handleError(res: Response, err: any, defaultMsg: string) {
  if (err.code === 'P2025') {
    return res.status(404).json(error('关联的业务记录不存在', 404));
  }
  if (err.code === 'P2002') {
    return res.status(409).json(error('数据冲突，记录可能已存在', 409));
  }
  return res.status(500).json(error(err.message || defaultMsg, 500));
}

// ============================================================
// 售后工单
// ============================================================

/** POST / - 创建售后工单 */
router.post(
  '/',
  requireRole('ADMIN', 'AFTERSALES'),
  async (req: AuthRequest, res: Response) => {
    try {
      const parsed = s.afterSalesCreateSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json(error(getValidationErrors(parsed), 400));
      }
      const result = await aftersalesService.createAfterSales(req.userId!, parsed.data);
      res.json(success(result, '售后工单创建成功'));
    } catch (err: any) {
      handleError(res, err, '创建售后工单失败');
    }
  },
);

/** GET / - 售后工单列表 */
router.get(
  '/',
  requireRole('ADMIN', 'AFTERSALES', 'BOSS', 'VIEWER'),
  async (req: AuthRequest, res: Response) => {
    try {
      const parsed = s.afterSalesQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        return res.status(400).json(error(getValidationErrors(parsed), 400));
      }
      const result = await aftersalesService.getAfterSalesList(parsed.data);
      res.json(paginated(result.data, result.total, result.page, result.pageSize));
    } catch (err: any) {
      handleError(res, err, '查询售后工单列表失败');
    }
  },
);

/** GET /:id - 售后工单详情 */
router.get(
  '/:id',
  requireRole('ADMIN', 'AFTERSALES', 'BOSS', 'VIEWER'),
  async (req: AuthRequest, res: Response) => {
    try {
      const result = await aftersalesService.getAfterSalesDetail(req.params.id as string);
      res.json(success(result, '查询成功'));
    } catch (err: any) {
      handleError(res, err, '查询售后工单详情失败');
    }
  },
);

/** PATCH /:id/status - 更新售后工单状态 */
router.patch(
  '/:id/status',
  requireRole('ADMIN', 'AFTERSALES'),
  async (req: AuthRequest, res: Response) => {
    try {
      const status = req.body.status as string;
      if (!status || !['PENDING', 'PROCESSING', 'COMPLETED', 'REJECTED'].includes(status)) {
        return res.status(400).json(error('状态值无效，可选: PENDING / PROCESSING / COMPLETED / REJECTED', 400));
      }
      const result = await aftersalesService.updateAfterSalesStatus(req.params.id as string, status, req.userId!);
      res.json(success(result, '售后状态更新成功'));
    } catch (err: any) {
      handleError(res, err, '更新售后状态失败');
    }
  },
);

// ============================================================
// 物流管理
// ============================================================

/** POST /logistics - 创建物流记录 */
router.post(
  '/logistics',
  requireRole('ADMIN', 'AFTERSALES'),
  async (req: AuthRequest, res: Response) => {
    try {
      const parsed = s.logisticsCreateSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json(error(getValidationErrors(parsed), 400));
      }
      const result = await logisticsService.createLogistics(req.userId!, parsed.data);
      res.json(success(result, '物流记录创建成功'));
    } catch (err: any) {
      handleError(res, err, '创建物流记录失败');
    }
  },
);

/** GET /logistics - 物流列表 */
router.get(
  '/logistics',
  requireRole('ADMIN', 'AFTERSALES', 'BOSS', 'VIEWER'),
  async (req: AuthRequest, res: Response) => {
    try {
      const parsed = s.logisticsQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        return res.status(400).json(error(getValidationErrors(parsed), 400));
      }
      const result = await logisticsService.getLogisticsList(parsed.data);
      res.json(paginated(result.data, result.total, result.page, result.pageSize));
    } catch (err: any) {
      handleError(res, err, '查询物流列表失败');
    }
  },
);

/** GET /logistics/track/:trackingNumber - 按运单号追踪（必须定义在 :id 之前） */
router.get(
  '/logistics/track/:trackingNumber',
  requireRole('ADMIN', 'AFTERSALES', 'BOSS', 'VIEWER'),
  async (req: AuthRequest, res: Response) => {
    try {
      const result = await logisticsService.trackLogistics(req.params.trackingNumber as string);
      res.json(success(result, '查询成功'));
    } catch (err: any) {
      handleError(res, err, '追踪物流失败');
    }
  },
);

/** GET /logistics/cost-summary - 物流费用汇总 */
router.get(
  '/logistics/cost-summary',
  requireRole('ADMIN', 'AFTERSALES', 'BOSS'),
  async (req: AuthRequest, res: Response) => {
    try {
      const startDate = req.query.startDate as string | undefined;
      const endDate = req.query.endDate as string | undefined;
      const result = await logisticsService.getShippingCostSummary(startDate, endDate);
      res.json(success(result, '查询成功'));
    } catch (err: any) {
      handleError(res, err, '查询物流费用汇总失败');
    }
  },
);

/** GET /logistics/:id - 物流详情 */
router.get(
  '/logistics/:id',
  requireRole('ADMIN', 'AFTERSALES', 'BOSS', 'VIEWER'),
  async (req: AuthRequest, res: Response) => {
    try {
      const result = await logisticsService.getLogisticsDetail(req.params.id as string);
      res.json(success(result, '查询成功'));
    } catch (err: any) {
      handleError(res, err, '查询物流详情失败');
    }
  },
);

/** PATCH /logistics/:id/status - 更新物流状态 */
router.patch(
  '/logistics/:id/status',
  requireRole('ADMIN', 'AFTERSALES'),
  async (req: AuthRequest, res: Response) => {
    try {
      const status = req.body.status as string;
      if (!status || !['PENDING', 'IN_TRANSIT', 'DELIVERED', 'EXCEPTION', 'RETURNED'].includes(status)) {
        return res.status(400).json(error('物流状态值无效，可选: PENDING / IN_TRANSIT / DELIVERED / EXCEPTION / RETURNED', 400));
      }
      const result = await logisticsService.updateLogisticsStatus(
        req.params.id as string,
        status,
        req.body.actualDelivery as string | undefined,
      );
      res.json(success(result, '物流状态更新成功'));
    } catch (err: any) {
      handleError(res, err, '更新物流状态失败');
    }
  },
);

export default router;
