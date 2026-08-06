import { Decimal } from '@prisma/client/runtime/library';

// ============================================================
// FIFO 批次分配 - 纯函数，无外部依赖
// ============================================================

/** 批次数据结构 */
export interface LotLike {
  id: string;
  quantityRemaining: Decimal;
  unitCost: Decimal;
  receivedAt: Date;
}

/** 分配结果 */
export interface FIFOAllocation {
  lotId: string;
  consumeQuantity: Decimal;
  unitCost: Decimal;
}

/**
 * 纯函数：根据 FIFO 规则分配消耗量
 * 
 * 规则：
 * 1. 只从 quantityRemaining > 0 的批次中选择
 * 2. 按 receivedAt 升序（最早入库的批次优先消耗）
 * 3. 不足时抛出错误
 * 
 * @param lots        - 可用批次列表（需已按 receivedAt 升序排列）
 * @param neededQty   - 需要的数量
 * @returns 分配结果数组
 * @throws 库存不足时抛出
 */
export function computeFIFOAllocation(
  lots: LotLike[],
  neededQty: Decimal,
): FIFOAllocation[] {
  const selected: FIFOAllocation[] = [];
  let remaining = neededQty;

  for (const lot of lots) {
    if (remaining.lte(0)) break;
    if (lot.quantityRemaining.lte(0)) continue;

    const consume = Decimal.min(lot.quantityRemaining, remaining);
    selected.push({
      lotId: lot.id,
      consumeQuantity: consume,
      unitCost: lot.unitCost,
    });
    remaining = Decimal.sub(remaining, consume);
  }

  if (remaining.gt(0)) {
    throw new FIFOInsufficientError(
      remaining.toString(),
      neededQty.toString(),
    );
  }

  return selected;
}

/**
 * 计算 FIFO 加权平均出库成本
 */
export function computeFIFOTotalCost(allocation: FIFOAllocation[]): Decimal {
  return allocation.reduce(
    (sum, a) => Decimal.add(sum, Decimal.mul(a.consumeQuantity, a.unitCost)),
    new Decimal(0),
  );
}

/**
 * FIFO 库存不足错误
 */
export class FIFOInsufficientError extends Error {
  constructor(
    public readonly shortage: string,
    public readonly needed: string,
  ) {
    super(`库存不足: 需要 ${needed}, 还差 ${shortage}`);
    this.name = 'FIFOInsufficientError';
  }
}

/**
 * 类型守卫：判断一个对象是否实现了 LotLike 接口
 */
export function isLotArray(value: unknown): value is LotLike[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    typeof (value[0] as any)?.id === 'string' &&
    (value[0] as any)?.quantityRemaining instanceof Decimal
  );
}
