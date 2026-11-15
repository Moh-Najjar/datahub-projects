import type { Kpi } from '@/modules/dashboard/types/dashboard';

export type TrendDirection = 'up' | 'down' | 'flat';

export interface KpiChange {
  direction: TrendDirection;
  /** Relative change for counts (0.05 = +5 %), absolute change in percentage points for rates. */
  value: number;
}

/**
 * Change against the previous period: relative for counts, in percentage points for rates (a rate's relative
 * change would be misleading). `null` when there is nothing to compare with.
 */
export function kpiChange(kpi: Kpi, kind: 'count' | 'rate'): KpiChange | null {
  if (kpi.previous === null) return null;
  const diff = kpi.current - kpi.previous;
  if (kind === 'count' && kpi.previous === 0) return null;
  const value = kind === 'rate' ? Math.round(diff * 10) / 10 : diff / kpi.previous;
  const direction: TrendDirection = value > 0 ? 'up' : value < 0 ? 'down' : 'flat';
  return { direction, value };
}
