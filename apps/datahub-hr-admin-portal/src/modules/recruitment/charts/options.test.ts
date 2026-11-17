import type { EChartsOption } from 'echarts';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { echarts } from '@/modules/shared/charts/echarts';
import type { ChartContext } from '@/modules/shared/charts/base';
import { resetRecruitmentMock, summary } from '@/modules/recruitment/mock/recruitmentMock';
import { CANDIDATE_STAGES } from '@/modules/recruitment/types/recruitment';
import { activityOption, funnelOption, requisitionOption, stageOption } from './options';

const EN: ChartContext = { mode: 'light', direction: 'ltr', language: 'en' };
const AR_DARK: ChartContext = { mode: 'dark', direction: 'rtl', language: 'ar' };

beforeAll(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 10, 16, 10, 30));
  resetRecruitmentMock();
});
afterAll(() => vi.useRealTimers());

const data = () => summary({ kind: 'organization', userId: 'usr-0002', role: 'hr-admin' });
/** Renders with the REAL ECharts engine (server-side SVG) — throws on invalid options. */
function renderSvg(option: EChartsOption): string {
  const chart = echarts.init(null, null, { renderer: 'svg', ssr: true, width: 640, height: 320 });
  chart.setOption({ ...option, animation: false });
  const svg = chart.renderToSVGString();
  chart.dispose();
  return svg;
}
type AnyRecord = Record<string, unknown>;
const series = (o: EChartsOption) => o.series as AnyRecord[];

describe('recruitment charts', () => {
  it('stages: one bar per stage with the summary counts; RTL mirrors the value axis', () => {
    const s = data();
    const option = stageOption(s.byStage, EN, CANDIDATE_STAGES, (x) => x, 'Candidates');
    expect((series(option)[0]!.data as Array<{ value: number }>).map((d) => d.value)).toEqual(CANDIDATE_STAGES.map((x) => s.byStage[x]));
    expect((stageOption(s.byStage, AR_DARK, CANDIDATE_STAGES, (x) => x, 'المرشحون').xAxis as AnyRecord).inverse).toBe(true);
    expect(renderSvg(option)).toContain('<svg');
  });

  it('activity: six months, four series; renders in Arabic dark without Arabic-Indic digits', () => {
    const s = data();
    const option = activityOption(s.monthly, AR_DARK, { applications: 'الطلبات', interviews: 'المقابلات', offers: 'العروض', hires: 'التعيينات' });
    expect(series(option)).toHaveLength(4);
    expect((series(option)[0]!.data as number[]).reduce((a, b) => a + b, 0)).toBe(s.monthly.reduce((a, m) => a + m.applications, 0));
    expect(renderSvg(option)).not.toMatch(/[٠-٩]/);
  });

  it('by requisition and funnel use the same summary', () => {
    const s = data();
    const req = requisitionOption(s.byRequisition, EN, { active: 'a', hired: 'h', other: 'o' });
    const totals = s.byRequisition.map((_, i) => series(req).reduce((sum, x) => sum + (x.data as number[])[i]!, 0));
    expect(totals).toEqual(s.byRequisition.map((r) => r.total));
    const funnel = funnelOption(s.funnel, EN, (x) => x, 'Candidates');
    expect((series(funnel)[0]!.data as Array<{ value: number }>).map((d) => d.value)).toEqual(s.funnel.map((f) => f.count));
    expect(renderSvg(funnel)).toContain('<svg');
  });
});
