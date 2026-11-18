import type { EChartsOption } from 'echarts';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { echarts } from '@/modules/shared/charts/echarts';
import type { ChartContext } from '@/modules/shared/charts/base';
import { overview, resetDocumentsMock } from '@/modules/documents/mock/documentsMock';
import { categoryOption, departmentOption, expiryOption, statusOption } from './options';

const EN: ChartContext = { mode: 'light', direction: 'ltr', language: 'en' };
const AR_DARK: ChartContext = { mode: 'dark', direction: 'rtl', language: 'ar' };

beforeAll(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 10, 16, 10, 30));
  resetDocumentsMock();
});
afterAll(() => vi.useRealTimers());

const data = () => overview({ userId: 'usr-0002', role: 'hr-admin' });
function renderSvg(option: EChartsOption): string {
  const chart = echarts.init(null, null, { renderer: 'svg', ssr: true, width: 640, height: 320 });
  chart.setOption({ ...option, animation: false });
  const svg = chart.renderToSVGString();
  chart.dispose();
  return svg;
}
type AnyRecord = Record<string, unknown>;
const series = (o: EChartsOption) => o.series as AnyRecord[];

describe('documents charts', () => {
  it('categories: top 10 plus "other", summing to the active documents', () => {
    const o = data();
    const option = categoryOption(o.byCategory, EN, 'Documents', 'Other');
    const values = series(option)[0]!.data as number[];
    expect(values.length).toBe(Math.min(11, o.byCategory.length));
    expect(values.reduce((a, b) => a + b, 0)).toBe(o.totals.active);
    expect(renderSvg(option)).toContain('<svg');
  });

  it('expiry: 12 months; RTL mirrors the axis', () => {
    const o = data();
    const option = expiryOption(o.expiry.months, AR_DARK, 'Expiring', (m) => m);
    expect((option.xAxis as AnyRecord).inverse).toBe(true);
    expect(series(option)[0]!.data).toEqual(o.expiry.months.map((m) => m.count));
    expect(renderSvg(option)).toContain('<svg');
  });

  it('status donut: non-empty statuses only, totals match', () => {
    const o = data();
    const option = statusOption(o.byStatus, EN, (s) => s);
    const slices = series(option)[0]!.data as Array<{ value: number }>;
    expect(slices.reduce((sum, s) => sum + s.value, 0)).toBe(o.totals.total);
    expect(slices.every((s) => s.value > 0)).toBe(true);
    expect(renderSvg(option)).toContain('<svg');
  });

  it('departments: one bar per top-level department', () => {
    const o = data();
    const option = departmentOption(o.byDepartment, AR_DARK, 'Documents');
    expect(series(option)[0]!.data).toEqual(o.byDepartment.map((d) => d.count));
    expect(renderSvg(option)).toContain('<svg');
  });
});
