import type { EChartsOption } from 'echarts';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { echarts } from '@/modules/shared/charts/echarts';
import type { ChartContext } from '@/modules/shared/charts/base';
import { resetPayrollMock, summary } from '@/modules/payroll/mock/payrollMock';
import { costTrendOption, departmentCostOption, grossNetOption, salaryRangeOption } from './options';

const EN: ChartContext = { mode: 'light', direction: 'ltr', language: 'en' };
const AR_DARK: ChartContext = { mode: 'dark', direction: 'rtl', language: 'ar' };

beforeAll(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 10, 16, 10, 30));
  resetPayrollMock();
});
afterAll(() => vi.useRealTimers());

const data = () => summary({ kind: 'organization', userId: 'usr-0002', role: 'hr-admin' });
function renderSvg(option: EChartsOption): string {
  const chart = echarts.init(null, null, { renderer: 'svg', ssr: true, width: 640, height: 320 });
  chart.setOption({ ...option, animation: false });
  const svg = chart.renderToSVGString();
  chart.dispose();
  return svg;
}
type AnyRecord = Record<string, unknown>;
const series = (o: EChartsOption) => o.series as AnyRecord[];
const tooltipHtml = (o: EChartsOption, params: unknown) => (o.tooltip as { formatter: (p: unknown) => string }).formatter(params);

describe('payroll charts', () => {
  it('monthly cost: basic + allowances stacked in whole units; the tooltip shows exact amounts', () => {
    const s = data();
    const option = costTrendOption(s.monthly, s.currency, EN, { basic: 'Basic', allowances: 'Allowances', overtime: 'Overtime', employees: 'Employees' });
    const october = s.monthly.findIndex((m) => m.month === '2026-10');
    expect((series(option)[0]!.data as number[])[october]).toBe(Math.floor(s.monthly[october]!.basic / 1000));
    const html = tooltipHtml(option, [{ seriesName: 'Basic', value: 0, color: '#000', dataIndex: october, seriesIndex: 0 }]);
    const exact = (s.monthly[october]!.basic / 1000).toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
    expect(html).toContain(`JOD ${exact}`);
    expect(html).toContain('October 2026');
    expect(renderSvg(option)).toContain('<svg');
  });

  it('gross vs net: lines with gaps for months without payroll; RTL mirrors the month axis', () => {
    const s = data();
    const option = grossNetOption(s.monthly, s.currency, AR_DARK, { gross: 'g', net: 'n' });
    expect((option.xAxis as AnyRecord).inverse).toBe(true);
    const gross = series(option)[0]!.data as Array<number | null>;
    s.monthly.forEach((m, i) => (m.employees === 0 ? expect(gross[i]).toBeNull() : expect(gross[i]).toBeGreaterThan(0)));
    expect(renderSvg(option)).toContain('<svg');
  });

  it('departments: one bar per department, summing to the latest period gross', () => {
    const s = data();
    const option = departmentCostOption(s.byDepartment, s.currency, EN, 'Gross', 'Employees');
    expect((series(option)[0]!.data as number[]).length).toBe(s.byDepartment.length);
    expect(s.byDepartment.reduce((sum, d) => sum + d.gross, 0)).toBe(s.latest!.gross);
    expect(renderSvg(option)).toContain('<svg');
  });

  it('salary ranges: employee counts per range in Latin digits (Arabic too)', () => {
    const s = data();
    const option = salaryRangeOption(s.salaryRanges, s.currency, AR_DARK, 'الموظفون');
    expect(series(option)[0]!.data).toEqual(s.salaryRanges.map((r) => r.employees));
    expect(((option.xAxis as AnyRecord).data as string[]).at(-1)).toBe('4,500+');
    expect(renderSvg(option)).toContain('<svg');
  });
});
