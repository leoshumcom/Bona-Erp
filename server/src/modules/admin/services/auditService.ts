import { prisma } from '../../../common/prisma';

// ============================================================
// 审计日志列表（分页）
// ============================================================
export async function getAuditLogs(filters: {
  entityType?: string;
  entityId?: string;
  action?: string;
  actorId?: string;
  startDate?: string;
  endDate?: string;
  page: number;
  pageSize: number;
}) {
  const where: any = {};

  if (filters.entityType) where.entityType = filters.entityType;
  if (filters.entityId) where.entityId = filters.entityId;
  if (filters.action) where.action = filters.action;
  if (filters.actorId) where.actorId = filters.actorId;

  if (filters.startDate || filters.endDate) {
    where.createdAt = {};
    if (filters.startDate) where.createdAt.gte = new Date(filters.startDate);
    if (filters.endDate) where.createdAt.lte = new Date(filters.endDate);
  }

  const [data, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      include: {
        actor: {
          select: { id: true, username: true, realName: true },
        },
      },
      skip: (filters.page - 1) * filters.pageSize,
      take: filters.pageSize,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.auditLog.count({ where }),
  ]);

  return { data, total, page: filters.page, pageSize: filters.pageSize };
}

// ============================================================
// 审计日志详情
// ============================================================
export async function getAuditLogDetail(id: string) {
  const log = await prisma.auditLog.findUniqueOrThrow({
    where: { id },
    include: {
      actor: {
        select: { id: true, username: true, realName: true, role: true },
      },
    },
  });

  return log;
}

// ============================================================
// 用户活动记录
// ============================================================
export async function getUserActivity(
  userId: string,
  startDate?: string,
  endDate?: string,
) {
  const where: any = { actorId: userId };

  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) where.createdAt.gte = new Date(startDate);
    if (endDate) where.createdAt.lte = new Date(endDate);
  }

  const activities = await prisma.auditLog.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 500,
  });

  // 按操作类型分组统计
  const actionSummary: Record<string, number> = {};
  for (const item of activities) {
    const key = `${item.entityType}:${item.action}`;
    actionSummary[key] = (actionSummary[key] || 0) + 1;
  }

  return {
    userId,
    totalActivities: activities.length,
    actionSummary,
    activities,
  };
}
