import { describe, expect, it } from 'vitest';
import { defaultFilters } from '@/modules/reports/utils/filters';
import { reportKeys } from './useReports';

describe('query keys', () => {
  it('hold the caller (user + role = scope) and the filters, so results are never shared across them', () => {
    const f = defaultFilters('2026-11-16');
    const hr = { userId: 'usr-0002', role: 'hr-admin' as const };
    const manager = { userId: 'usr-0004', role: 'department-manager' as const };
    expect(reportKeys.report(hr, 'employees.directory', f)).toEqual(['reports', 'report', 'usr-0002', 'hr-admin', 'employees.directory', f]);
    expect(reportKeys.report(hr, 'employees.directory', f)).not.toEqual(reportKeys.report(manager, 'employees.directory', f));
    expect(reportKeys.overview(hr, f)).not.toEqual(reportKeys.overview(hr, { ...f, departmentId: 'dep-eng' }));
    // Everything lives under ['reports'] (one invalidation clears it).
    for (const key of [reportKeys.scope(hr), reportKeys.overview(hr, f), reportKeys.insights(hr, f), reportKeys.executive(hr, f), reportKeys.saved(hr)]) expect(key[0]).toBe('reports');
  });
});
