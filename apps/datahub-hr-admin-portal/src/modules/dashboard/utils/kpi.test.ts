import { describe, expect, it } from 'vitest';
import { kpiChange } from './kpi';

describe('kpiChange', () => {
  it('relative change for counts', () => {
    expect(kpiChange({ current: 110, previous: 100 }, 'count')).toEqual({ direction: 'up', value: 0.1 });
    expect(kpiChange({ current: 90, previous: 100 }, 'count')).toEqual({ direction: 'down', value: -0.1 });
    expect(kpiChange({ current: 5, previous: 5 }, 'count')).toEqual({ direction: 'flat', value: 0 });
  });

  it('percentage points for rates', () => {
    expect(kpiChange({ current: 94.5, previous: 93.2 }, 'rate')).toEqual({ direction: 'up', value: 1.3 });
  });

  it('no comparison without a previous value (or from zero)', () => {
    expect(kpiChange({ current: 3, previous: null }, 'count')).toBeNull();
    expect(kpiChange({ current: 3, previous: 0 }, 'count')).toBeNull();
  });
});
