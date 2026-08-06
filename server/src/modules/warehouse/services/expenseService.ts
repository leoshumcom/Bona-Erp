import { Prisma } from '@prisma/client';
import { prisma } from '../../../common/prisma';

const EXPENSE_TYPES = ['rent', 'packaging', 'loss', 'salary', 'management', 'other'] as const;

function paginate(page: number, pageSize: number) {
  return { skip: (page - 1) * pageSize, take: pageSize };
}

// ============================================================
// 仓库费用 CRUD
// ============================================================

export interface CreateWarehouseExpenseParams {
  warehouseId?: string;
  expenseType: string;
  amount: number;
  expenseMonth: string;
  notes?: string;
}

/** 创建仓库费用记录 */
export async function createWarehouseExpense(_userId: string, params: CreateWarehouseExpenseParams) {
  if (!EXPENSE_TYPES.includes(params.expenseType as any)) {
    throw new Error(`费用类型无效，可选: ${EXPENSE_TYPES.join(' / ')}`);
  }

  return prisma.warehouseExpense.create({
    data: {
      warehouseId: params.warehouseId || null,
      expenseType: params.expenseType,
      amount: params.amount,
      expenseMonth: params.expenseMonth,
      notes: params.notes,
    },
  });
}

export interface WarehouseExpenseFilters {
  expenseMonth?: string;
  expenseType?: string;
  warehouseId?: string;
  page: number;
  pageSize: number;
}

/** 仓库费用列表（分页） */
export async function getWarehouseExpenses(filters: WarehouseExpenseFilters) {
  const where: Prisma.WarehouseExpenseWhereInput = {};

  if (filters.expenseMonth) where.expenseMonth = filters.expenseMonth;
  if (filters.expenseType) where.expenseType = filters.expenseType;
  if (filters.warehouseId) where.warehouseId = filters.warehouseId;

  const [data, total] = await Promise.all([
    prisma.warehouseExpense.findMany({
      where,
      ...paginate(filters.page, filters.pageSize),
      orderBy: { createdAt: 'desc' },
    }),
    prisma.warehouseExpense.count({ where }),
  ]);

  return { data, total, page: filters.page, pageSize: filters.pageSize };
}

/** 仓库费用详情 */
export async function getWarehouseExpenseDetail(id: string) {
  const record = await prisma.warehouseExpense.findUnique({ where: { id } });
  if (!record) throw new Error('仓库费用记录不存在');
  return record;
}

/** 更新仓库费用 */
export async function updateWarehouseExpense(id: string, params: Partial<CreateWarehouseExpenseParams>) {
  const existing = await prisma.warehouseExpense.findUnique({ where: { id } });
  if (!existing) throw new Error('仓库费用记录不存在');

  const updateData: Prisma.WarehouseExpenseUpdateInput = {};
  if (params.expenseType !== undefined) {
    if (!EXPENSE_TYPES.includes(params.expenseType as any)) {
      throw new Error(`费用类型无效，可选: ${EXPENSE_TYPES.join(' / ')}`);
    }
    updateData.expenseType = params.expenseType;
  }
  if (params.amount !== undefined) updateData.amount = params.amount;
  if (params.expenseMonth !== undefined) updateData.expenseMonth = params.expenseMonth;
  if (params.notes !== undefined) updateData.notes = params.notes;
  if (params.warehouseId !== undefined) updateData.warehouseId = params.warehouseId || null;

  return prisma.warehouseExpense.update({
    where: { id },
    data: updateData,
  });
}

/** 删除仓库费用 */
export async function deleteWarehouseExpense(id: string) {
  const existing = await prisma.warehouseExpense.findUnique({ where: { id } });
  if (!existing) throw new Error('仓库费用记录不存在');
  return prisma.warehouseExpense.delete({ where: { id } });
}

export interface WarehouseCostSummaryResult {
  totalRent: number;
  totalPackaging: number;
  totalLoss: number;
  totalSalary: number;
  totalManagement: number;
  totalOther: number;
  grandTotal: number;
  recordCount: number;
}

/** 仓库费用汇总（按月） */
export async function getWarehouseExpenseSummary(expenseMonth?: string) {
  const where: Prisma.WarehouseExpenseWhereInput = {};
  if (expenseMonth) where.expenseMonth = expenseMonth;

  const records = await prisma.warehouseExpense.findMany({ where });

  const summary: WarehouseCostSummaryResult = {
    totalRent: 0,
    totalPackaging: 0,
    totalLoss: 0,
    totalSalary: 0,
    totalManagement: 0,
    totalOther: 0,
    grandTotal: 0,
    recordCount: records.length,
  };

  for (const r of records) {
    const amt = Number(r.amount);
    switch (r.expenseType) {
      case 'rent': summary.totalRent += amt; break;
      case 'packaging': summary.totalPackaging += amt; break;
      case 'loss': summary.totalLoss += amt; break;
      case 'salary': summary.totalSalary += amt; break;
      case 'management': summary.totalManagement += amt; break;
      default: summary.totalOther += amt; break;
    }
    summary.grandTotal += amt;
  }

  return summary;
}
