import type { EChartsOption } from 'echarts';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { echarts } from '@/modules/shared/charts/echarts';
import type { ChartContext } from '@/modules/shared/charts/base';
import { resetPerformanceMock, summary } from '@/modules/performance/mock/performanceMock';
import { completionOption, departmentOption, distributionOption, trendOption } from './options';

const EN: ChartContext = { mode: 'light', direction: 'ltr', language: 'en' };
const AR_DARK: ChartContext = { mode: 'dark', direction: 'rtl', language: 'ar' };

beforeAll(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 10, 16, 10, 30));
  resetPerformanceMock();
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

describe('performance charts', () => {
  it('distribution: one bar per scale value with the summary counts', () => {
    const s = data();
    const option = distributionOption(s.distribution, EN, (v) => String(v), 'Reviews');
    expect((series(option)[0]!.data as Array<{ value: number }>).map((d) => d.value)).toEqual(s.distribution.map((d) => d.count));
    expect(renderSvg(option)).toContain('<svg');
  });

  it('completion: stacked per cycle; totals equal the cycle reviews; RTL mirrors', () => {
    const s = data();
    const option = completionOption(s.completion, AR_DARK, { completed: 'c', pendingManager: 'm', pendingSelf: 's' });
    const totals = s.completion.map((_, i) => series(option).reduce((sum, x) => sum + (x.data as number[])[i]!, 0));
    expect(totals).toEqual(s.completion.map((c) => c.completed + c.pendingManager + c.pendingSelf));
    expect((option.xAxis as AnyRecord).inverse).toBe(true);
    expect(renderSvg(option)).not.toMatch(/[٠-٩]/);
  });

  it('department comparison and trend use averages on the scale', () => {
    const s = data();
    const dept = departmentOption(s.byDepartment, EN, 'Average', 5);
    expect(series(dept)[0]!.data).toEqual(s.byDepartment.map((d) => d.average));
    const trend = trendOption(s.trend, AR_DARK, 'متوسط', 5);
    expect(series(trend)[0]!.data).toEqual(s.trend.map((x) => x.average));
    expect((trend.xAxis as AnyRecord).inverse).toBe(true);
    expect(renderSvg(trend)).toContain('<svg');
  });
});
