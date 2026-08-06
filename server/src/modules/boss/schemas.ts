import { z } from 'zod';

// ========== 看板查询 ==========

export const dateQuerySchema = z.object({
  date: z.string().optional(),
});

export const periodQuerySchema = z.object({
  period: z.enum(['7d', '30d', '12m']).default('7d'),
});

export const dateRangeQuerySchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});
