import type { EChartsOption } from 'echarts';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { chartColors } from '@/core/theme/tokens';
import { echarts } from '@/modules/shared/charts/echarts';
import type { ChartContext } from '@/modules/shared/charts/base';
import { summary } from '@/modules/leave/mock/leaveMock';
import { resetLeaveStore } from '@/modules/leave/mock/leaveStore';
import { departmentOption, monthlyOption, statusOption, typeOption } from './options';

const EN_LTR: ChartContext = { mode: 'light', direction: 'ltr', language: 'en' };
const AR_DARK: ChartContext = { mode: 'dark', direction: 'rtl', language: 'ar' };
const labels = { approved: 'Approved', pending: 'Pending', rejected: 'Rejected', cancelled: 'Cancelled' };

beforeAll(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 10, 16, 10, 30));
  resetLeaveStore();
});
afterAll(() => vi.useRealTimers());

const data = () => summary(2026, { kind: 'organization', userId: 'usr-0002', role: 'hr-admin' });

/** Renders an option with the REAL ECharts engine (server-side SVG) — throws on invalid options. */
function renderSvg(option: EChartsOption): string {
  const chart = echarts.init(null, null, { renderer: 'svg', ssr: true, width: 640, height: 320 });
  chart.setOption({ ...option, animation: false });
  const svg = chart.renderToSVGString();
  chart.dispose();
  return svg;
}
type AnyRecord = Record<string, unknown>;
const series = (o: EChartsOption) => o.series as AnyRecord[];

describe('leave charts', () => {
  it('status doughnut: one slice per status with requests, status colours', () => {
    const s = data();
    const option = statusOption(s.byStatus, EN_LTR, labels);
    const slices = series(option)[0]!.data as Array<{ name: string; value: number; itemStyle: { color: string } }>;
    expect(slices.find((x) => x.name === 'Approved')).toMatchObject({ value: s.byStatus.approved, itemStyle: { color: chartColors.light.green } });
    expect(renderSvg(option)).toContain('<svg');
  });

  it('monthly trend: 12 months stacked by status; mirrored in RTL', () => {
    const s = data();
    const option = monthlyOption(s.monthly, EN_LTR, labels);
    expect((option.xAxis as AnyRecord).data).toHaveLength(12);
    const total = series(option).reduce((sum, x) => sum + (x.data as number[]).reduce((a, b) => a + b, 0), 0);
    expect(total).toBe(s.total);
    const rtl = monthlyOption(s.monthly, AR_DARK, labels);
    expect((rtl.xAxis as AnyRecord).inverse).toBe(true);
    expect((rtl.yAxis as AnyRecord).position).toBe('right');
    expect(renderSvg(rtl)).toContain('<svg');
  });

  it('by type and by department add up to the days used; Arabic names, Latin digits', () => {
    const s = data();
    const types = typeOption(s.byType, AR_DARK, (d) => `${d}`);
    expect((series(types)[0]!.data as Array<{ value: number }>).reduce((a, b) => a + b.value, 0)).toBe(s.daysUsed);
    expect((series(types)[0]!.data as Array<{ name: string }>)[0]!.name).toMatch(/[؀-ۿ]/);
    const depts = departmentOption(s.byDepartment, AR_DARK, 'الأيام المعتمدة');
    expect((series(depts)[0]!.data as number[]).reduce((a, b) => a + b, 0)).toBe(s.daysUsed);
    expect((depts.xAxis as AnyRecord).inverse).toBe(true);
    const svg = renderSvg(depts);
    expect(svg).not.toMatch(/[٠-٩]/);
  });
});
