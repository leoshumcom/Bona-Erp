import { Prisma } from '@prisma/client';
import { prisma } from '../../../common/prisma';

// ============================================================
// 一、创建广告活动
// ============================================================

export async function createCampaign(
  userId: string,
  params: {
    storeId: string;
    campaignName: string;
    platformCampaignId?: string;
    campaignType: string;
    spend?: number;
    startDate: string;
    endDate?: string;
    impressions?: number;
    clicks?: number;
    orders?: number;
    sales?: number;
  },
) {
  // 验证店铺存在
  await prisma.store.findUniqueOrThrow({ where: { id: params.storeId } });

  const campaign = await prisma.adCampaign.create({
    data: {
      storeId: params.storeId,
      campaignName: params.campaignName,
      platformCampaignId: params.platformCampaignId,
      campaignType: params.campaignType,
      spend: new Prisma.Decimal(params.spend ?? 0),
      startDate: new Date(params.startDate),
      endDate: params.endDate ? new Date(params.endDate) : undefined,
      impressions: params.impressions ?? 0,
      clicks: params.clicks ?? 0,
      orders: params.orders ?? 0,
      sales: new Prisma.Decimal(params.sales ?? 0),
    },
    include: {
      store: { select: { id: true, name: true } },
    },
  });

  return campaign;
}

// ============================================================
// 二、广告活动列表
// ============================================================

export async function getCampaigns(filters: {
  storeId?: string;
  campaignType?: string;
  startDate?: string;
  endDate?: string;
  page: number;
  pageSize: number;
}) {
  const where: any = {};

  if (filters.storeId) where.storeId = filters.storeId;
  if (filters.campaignType) where.campaignType = filters.campaignType;

  if (filters.startDate || filters.endDate) {
    where.startDate = {};
    if (filters.startDate) where.startDate.gte = new Date(filters.startDate);
    if (filters.endDate) where.startDate.lte = new Date(filters.endDate);
  }

  const [data, total] = await Promise.all([
    prisma.adCampaign.findMany({
      where,
      include: {
        store: { select: { id: true, name: true, storeId: true } },
      },
      skip: (filters.page - 1) * filters.pageSize,
      take: filters.pageSize,
      orderBy: { startDate: 'desc' },
    }),
    prisma.adCampaign.count({ where }),
  ]);

  return { data, total, page: filters.page, pageSize: filters.pageSize };
}

// ============================================================
// 三、更新广告活动
// ============================================================

export async function updateCampaign(
  id: string,
  params: {
    campaignName?: string;
    campaignType?: string;
    spend?: number;
    startDate?: string;
    endDate?: string;
    impressions?: number;
    clicks?: number;
    orders?: number;
    sales?: number;
  },
) {
  const data: any = {};

  if (params.campaignName !== undefined) data.campaignName = params.campaignName;
  if (params.campaignType !== undefined) data.campaignType = params.campaignType;
  if (params.spend !== undefined) data.spend = new Prisma.Decimal(params.spend);
  if (params.startDate !== undefined) data.startDate = new Date(params.startDate);
  if (params.endDate !== undefined) data.endDate = new Date(params.endDate);
  if (params.impressions !== undefined) data.impressions = params.impressions;
  if (params.clicks !== undefined) data.clicks = params.clicks;
  if (params.orders !== undefined) data.orders = params.orders;
  if (params.sales !== undefined) data.sales = new Prisma.Decimal(params.sales);

  const campaign = await prisma.adCampaign.update({
    where: { id },
    data,
    include: {
      store: { select: { id: true, name: true } },
    },
  });

  return campaign;
}

// ============================================================
// 四、结束广告活动
// ============================================================

export async function endCampaign(id: string) {
  const campaign = await prisma.adCampaign.update({
    where: { id },
    data: {
      endDate: new Date(),
    },
    include: {
      store: { select: { id: true, name: true } },
    },
  });

  return campaign;
}

// ============================================================
// 五、广告花费汇总（按广告类型分组）
// ============================================================

export async function getAdSpendSummary(
  storeId?: string,
  startDate?: string,
  endDate?: string,
) {
  const where: any = {};

  if (storeId) where.storeId = storeId;
  if (startDate || endDate) {
    where.startDate = {};
    if (startDate) where.startDate.gte = new Date(startDate);
    if (endDate) where.startDate.lte = new Date(endDate);
  }

  // 按 campaignType 分组聚合
  const campaigns = await prisma.adCampaign.findMany({ where });

  const grouped = new Map<string, { totalSpend: number; totalSales: number; count: number }>();

  for (const c of campaigns) {
    if (!grouped.has(c.campaignType)) {
      grouped.set(c.campaignType, { totalSpend: 0, totalSales: 0, count: 0 });
    }
    const entry = grouped.get(c.campaignType)!;
    entry.totalSpend += Number(c.spend);
    entry.totalSales += Number(c.sales);
    entry.count += 1;
  }

  const summary = Array.from(grouped.entries()).map(([type, data]) => ({
    campaignType: type,
    campaignCount: data.count,
    totalSpend: data.totalSpend,
    totalSales: data.totalSales,
    roas: data.totalSpend > 0 ? (data.totalSales / data.totalSpend).toFixed(2) : '0',
  }));

  const totalSpend = summary.reduce((sum, s) => sum + s.totalSpend, 0);
  const totalSales = summary.reduce((sum, s) => sum + s.totalSales, 0);

  return {
    summary,
    totalSpend,
    totalSales,
    overallROAS: totalSpend > 0 ? (totalSales / totalSpend).toFixed(2) : '0',
  };
}
