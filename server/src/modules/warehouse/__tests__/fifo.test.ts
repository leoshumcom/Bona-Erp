import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Decimal } from '@prisma/client/runtime/library';
import {
  computeFIFOAllocation,
  computeFIFOTotalCost,
  FIFOInsufficientError,
  type LotLike,
} from '../services/fifo';

// 辅助函数：快速创建测试用批次
function lot(
  id: string,
  remaining: number,
  cost: number,
  receivedOffsetMinutes: number = 0,
): LotLike {
  return {
    id,
    quantityRemaining: new Decimal(remaining),
    unitCost: new Decimal(cost),
    receivedAt: new Date(Date.now() + receivedOffsetMinutes * 60_000),
  };
}

// ============================================================
// 1. FIFO 纯函数测试（核心算法，无外部依赖）
// ============================================================
describe('computeFIFOAllocation - FIFO 批次分配算法', () => {
  it('单批次精确匹配: 需要100, 批次有100 → 全消耗', () => {
    const lots = [lot('A', 100, 5.5)];
    const result = computeFIFOAllocation(lots, new Decimal(100));

    expect(result).toHaveLength(1);
    expect(result[0].lotId).toBe('A');
    expect(result[0].consumeQuantity.toString()).toBe('100');
    expect(result[0].unitCost.toString()).toBe('5.5');
  });

  it('单批次部分消耗: 需要30, 批次有100 → 只消耗30', () => {
    const lots = [lot('A', 100, 10)];
    const result = computeFIFOAllocation(lots, new Decimal(30));

    expect(result).toHaveLength(1);
    expect(result[0].lotId).toBe('A');
    expect(result[0].consumeQuantity.toString()).toBe('30');
    expect(result[0].unitCost.toString()).toBe('10');
  });

  it('多批次FIFO: 按receivedAt升序，先入库先消耗', () => {
    // 批次 B 最早入库(2小时前), A 其次(1小时前), C 最新(现在)
    const lots = [
      lot('B', 50, 12, -120),  // 2小时前入库，cost=12
      lot('A', 100, 10, -60),  // 1小时前入库，cost=10
      lot('C', 80, 15, 0),     // 刚刚入库，cost=15
    ];
    const result = computeFIFOAllocation(lots, new Decimal(120));

    expect(result).toHaveLength(2);
    // 先消耗最早的B(50，单价12)，再消耗A(70/100，单价10)
    expect(result[0].lotId).toBe('B');
    expect(result[0].consumeQuantity.toString()).toBe('50');
    expect(result[0].unitCost.toString()).toBe('12');

    expect(result[1].lotId).toBe('A');
    expect(result[1].consumeQuantity.toString()).toBe('70');
    expect(result[1].unitCost.toString()).toBe('10');
  });

  it('跨三个批次消耗: 120 → B(50)+A(100)+C(部分)', () => {
    const lots = [
      lot('B', 50, 12, -120),
      lot('A', 100, 10, -60),
      lot('C', 80, 15, 0),
    ];
    const result = computeFIFOAllocation(lots, new Decimal(200));

    expect(result).toHaveLength(3);
    expect(result[0].lotId).toBe('B');
    expect(result[0].consumeQuantity.toString()).toBe('50');
    expect(result[1].lotId).toBe('A');
    expect(result[1].consumeQuantity.toString()).toBe('100');
    expect(result[2].lotId).toBe('C');
    expect(result[2].consumeQuantity.toString()).toBe('50');
  });

  it('完全消耗所有批次', () => {
    const lots = [
      lot('B', 50, 10, -60),
      lot('A', 100, 8, -30),
    ];
    const result = computeFIFOAllocation(lots, new Decimal(150));

    expect(result).toHaveLength(2);
    expect(result[0].consumeQuantity.toString()).toBe('50');
    expect(result[1].consumeQuantity.toString()).toBe('100');
  });

  it('跳过 quantityRemaining=0 的批次', () => {
    const lots = [
      lot('EMPTY', 0, 5, -120),       // 已被用完，应跳过
      lot('A', 100, 10, -60),
    ];
    const result = computeFIFOAllocation(lots, new Decimal(50));

    expect(result).toHaveLength(1);
    expect(result[0].lotId).toBe('A');
    expect(result[0].consumeQuantity.toString()).toBe('50');
  });

  it('库存不足: 需要200但只有150 → 抛出 FIFOInsufficientError', () => {
    const lots = [
      lot('A', 100, 10, -60),
      lot('B', 50, 12, -30),
    ];
    expect(() => {
      computeFIFOAllocation(lots, new Decimal(200));
    }).toThrow(FIFOInsufficientError);

    try {
      computeFIFOAllocation(lots, new Decimal(200));
    } catch (e) {
      expect(e).toBeInstanceOf(FIFOInsufficientError);
      const err = e as FIFOInsufficientError;
      expect(err.shortage).toBe('50');   // 还差50
      expect(err.needed).toBe('200');
    }
  });

  it('空批次列表 → 抛出 FIFOInsufficientError', () => {
    expect(() => {
      computeFIFOAllocation([], new Decimal(10));
    }).toThrow(FIFOInsufficientError);
  });

  it('所有批次剩余为0 → 抛出 FIFOInsufficientError', () => {
    const lots = [
      lot('A', 0, 10, -60),
      lot('B', 0, 5, -30),
    ];
    expect(() => {
      computeFIFOAllocation(lots, new Decimal(10));
    }).toThrow(FIFOInsufficientError);
  });

  it('小数精度: 33.3333 → 正确分配', () => {
    const lots = [
      lot('A', 50, 10.5555, -60),
      lot('B', 50, 9.1234, -30),
    ];
    const result = computeFIFOAllocation(lots, new Decimal(33.3333));

    expect(result).toHaveLength(1);
    expect(result[0].lotId).toBe('A');
    expect(result[0].consumeQuantity.toString()).toBe('33.3333');
  });

  it('高精度金额: 4位小数成本', () => {
    const lots = [
      lot('A', 100, 12.3456, -60),
      lot('B', 200, 13.5678, -30),
    ];
    const result = computeFIFOAllocation(lots, new Decimal(150));

    expect(result[0].unitCost.toString()).toBe('12.3456');
    expect(result[1].unitCost.toString()).toBe('13.5678');
    expect(result[0].consumeQuantity.toString()).toBe('100');
    expect(result[1].consumeQuantity.toString()).toBe('50');
  });
});

// ============================================================
// 2. FIFO 总成本计算测试
// ============================================================
describe('computeFIFOTotalCost - 加权成本计算', () => {
  it('单批次: 100 * 10 = 1000', () => {
    const allocation = [
      { lotId: 'A', consumeQuantity: new Decimal(100), unitCost: new Decimal(10) },
    ];
    const cost = computeFIFOTotalCost(allocation);
    expect(cost.toString()).toBe('1000');
  });

  it('双批次: 50*12 + 70*10 = 1300', () => {
    const allocation = [
      { lotId: 'B', consumeQuantity: new Decimal(50), unitCost: new Decimal(12) },
      { lotId: 'A', consumeQuantity: new Decimal(70), unitCost: new Decimal(10) },
    ];
    const cost = computeFIFOTotalCost(allocation);
    expect(cost.toString()).toBe('1300');
  });

  it('三位批次精确计算: 50*12.3456 + 100*13.5678 + 50*15 = ???', () => {
    const allocation = [
      { lotId: 'B', consumeQuantity: new Decimal(50),   unitCost: new Decimal(12.3456) },
      { lotId: 'A', consumeQuantity: new Decimal(100),  unitCost: new Decimal(13.5678) },
      { lotId: 'C', consumeQuantity: new Decimal(50),   unitCost: new Decimal(15) },
    ];
    const cost = computeFIFOTotalCost(allocation);
    // 50*12.3456=617.28 + 100*13.5678=1356.78 + 50*15=750 = 2724.06
    expect(cost.toString()).toBe('2724.06');
  });

  it('空分配列表 → 0', () => {
    const cost = computeFIFOTotalCost([]);
    expect(cost.toString()).toBe('0');
  });
});

// ============================================================
// 3. API 参数校验测试 (Zod Schema)
// ============================================================
describe('Zod 校验 - 入库/出库参数', () => {
  let schemas: typeof import('../schemas');

  beforeEach(async () => {
    schemas = await import('../schemas');
  });

  it('生产入库: quantity=0 → 校验失败', () => {
    const result = schemas.inboundProductionSchema.safeParse({
      productionOrderId: '00000000-0000-0000-0000-000000000001',
      productId: '00000000-0000-0000-0000-000000000002',
      quantity: 0,
      unitOfMeasureId: '00000000-0000-0000-0000-000000000003',
      storageLocationId: '00000000-0000-0000-0000-000000000004',
      unitCost: 10,
    });
    expect(result.success).toBe(false);
  });

  it('生产入库: quantity=-5 → 校验失败', () => {
    const result = schemas.inboundProductionSchema.safeParse({
      productionOrderId: '00000000-0000-0000-0000-000000000001',
      productId: '00000000-0000-0000-0000-000000000002',
      quantity: -5,
      unitOfMeasureId: '00000000-0000-0000-0000-000000000003',
      storageLocationId: '00000000-0000-0000-0000-000000000004',
      unitCost: 10,
    });
    expect(result.success).toBe(false);
  });

  it('生产入库: 全部合法 → 校验通过', () => {
    const result = schemas.inboundProductionSchema.safeParse({
      productionOrderId: '00000000-0000-0000-0000-000000000001',
      productId: '00000000-0000-0000-0000-000000000002',
      quantity: 100,
      unitOfMeasureId: '00000000-0000-0000-0000-000000000003',
      storageLocationId: '00000000-0000-0000-0000-000000000004',
      unitCost: 25.5,
      notes: '测试备注',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.quantity).toBe(100);
      expect(result.data.unitCost).toBe(25.5);
    }
  });

  it('生产领料: 缺少 productionOrderComponentId → 校验失败', () => {
    const result = schemas.outboundIssueSchema.safeParse({
      productId: '00000000-0000-0000-0000-000000000002',
      quantity: 10,
      unitOfMeasureId: '00000000-0000-0000-0000-000000000003',
      storageLocationId: '00000000-0000-0000-0000-000000000004',
    });
    expect(result.success).toBe(false);
  });

  it('销售出库: 缺少 orderId → 校验失败', () => {
    const result = schemas.outboundShipmentSchema.safeParse({
      productId: '00000000-0000-0000-0000-000000000002',
      quantity: 10,
      unitOfMeasureId: '00000000-0000-0000-0000-000000000003',
      storageLocationId: '00000000-0000-0000-0000-000000000004',
    });
    expect(result.success).toBe(false);
  });

  it('盘点调整: 正负差异均可通过', () => {
    const result = schemas.countAdjustSchema.safeParse({
      countPlanId: '00000000-0000-0000-0000-000000000001',
      adjustments: [
        {
          productId: '00000000-0000-0000-0000-000000000002',
          storageLocationId: '00000000-0000-0000-0000-000000000003',
          difference: -5,   // 盘亏
          unitOfMeasureId: '00000000-0000-0000-0000-000000000004',
          reason: '破损',
        },
        {
          productId: '00000000-0000-0000-0000-000000000005',
          storageLocationId: '00000000-0000-0000-0000-000000000006',
          difference: 3,    // 盘盈
          unitOfMeasureId: '00000000-0000-0000-0000-000000000007',
        },
      ],
    });
    expect(result.success).toBe(true);
  });
});

// ============================================================
// 4. 集成对比测试：旧实现 vs 新纯函数
// ============================================================
describe('FIFO 纯度验证 - 新旧逻辑完全一致', () => {
  /**
   * 这是旧版内联 FIFO 逻辑的独立副本，用于验证新版纯函数
   * 输出结果完全相同
   */
  function oldFIFOImpl(lots: LotLike[], neededQty: Decimal) {
    const selected: Array<{ lotId: string; consumeQuantity: Decimal; unitCost: Decimal }> = [];
    let remaining = neededQty;

    for (const lot of lots) {
      if (remaining.lte(0)) break;
      const consume = Decimal.min(lot.quantityRemaining, remaining);
      selected.push({ lotId: lot.id, consumeQuantity: consume, unitCost: lot.unitCost });
      remaining = Decimal.sub(remaining, consume);
    }

    if (remaining.gt(0)) {
      throw new Error(`库存不足: 需要 ${neededQty}, 还差 ${remaining}`);
    }
    return selected;
  }

  it('新旧实现在 10 组随机场景下输出一致', () => {
    for (let seed = 0; seed < 10; seed++) {
      const lots: LotLike[] = [];
      let remainingCount = 0;
      // 随机生成 3-6 个批次
      const numLots = 3 + (seed % 4);
      for (let i = 0; i < numLots; i++) {
        const qty = 10 + ((seed * 17 + i * 31) % 100);
        const cost = 5 + ((seed * 13 + i * 7) % 20);
        lots.push({
          id: `lot-${seed}-${i}`,
          quantityRemaining: new Decimal(qty),
          unitCost: new Decimal(cost),
          receivedAt: new Date(Date.now() + i * 60_000),
        });
        remainingCount += qty;
      }

      const needed = 5 + ((seed * 23) % remainingCount); // 保证不超过总量
      const newResult = computeFIFOAllocation(lots, new Decimal(needed));
      const oldResult = oldFIFOImpl(lots, new Decimal(needed));

      expect(newResult).toHaveLength(oldResult.length);
      for (let j = 0; j < newResult.length; j++) {
        expect(newResult[j].lotId).toBe(oldResult[j].lotId);
        expect(newResult[j].consumeQuantity.toString()).toBe(oldResult[j].consumeQuantity.toString());
        expect(newResult[j].unitCost.toString()).toBe(oldResult[j].unitCost.toString());
      }
    }
  });
});
