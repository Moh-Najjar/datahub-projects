import type { EChartsOption } from 'echarts';
import { describe, expect, it } from 'vitest';
import { echarts } from '@/modules/shared/charts/echarts';
import type { ChartContext } from '@/modules/shared/charts/base';
import type { ChartSpec } from '@/modules/reports/types/reports';
import { chartValueText } from '@/modules/reports/utils/format';
import { drawn, reportChartOption } from './options';

/* Every report chart type rendered by the REAL ECharts engine (SSR → SVG), in English/light and Arabic/dark. */
const EN: ChartContext = { mode: 'light', direction: 'ltr', language: 'en' };
const AR_DARK: ChartContext = { mode: 'dark', direction: 'rtl', language: 'ar' };

function renderSvg(option: EChartsOption): string {
  const chart = echarts.init(null, null, { renderer: 'svg', ssr: true, width: 640, height: 320 });
  chart.setOption({ ...option, animation: false });
  const svg = chart.renderToSVGString();
  chart.dispose();
  return svg;
}
const labels = (spec: ChartSpec, ctx: ChartContext) => {
  const { exact, axis } = chartValueText(ctx.language, spec);
  return { series: (k: string) => `S:${k}`, categories: spec.categories.map(String), value: exact, axis };
};
type AnyRecord = Record<string, unknown>;
const series = (o: EChartsOption) => o.series as AnyRecord[];
const tooltipHtml = (o: EChartsOption, params: unknown) => (o.tooltip as { formatter: (p: unknown) => string }).formatter(params);

const money: ChartSpec = { type: 'bar', valueKind: 'money', categoryKind: 'month', categories: ['2026-09', '2026-10', '2026-11'], series: [{ key: 'gross', values: [123_456_789, null, 1_000] }] };
const percent: ChartSpec = { type: 'line', valueKind: 'percent', categoryKind: 'month', categories: ['2026-09', '2026-10'], series: [{ key: 'attendanceRate', values: [0.9134, null] }] };

describe('report charts', () => {
  it('money: whole dinars for drawing, exact amounts in tooltips, gaps for missing months', () => {
    const option = reportChartOption(money, EN, labels(money, EN));
    expect(series(option)[0]!.data).toEqual([123_456, null, 1]);
    const html = tooltipHtml(option, [{ seriesIndex: 0, dataIndex: 0, color: '#000' }]);
    expect(html).toContain('JOD 123,456.789');
    expect(tooltipHtml(option, [{ seriesIndex: 0, dataIndex: 1, color: '#000' }])).toContain('—');
    expect(renderSvg(option)).toContain('<svg');
  });

  it('percentages: drawn 0–100, shown with one decimal', () => {
    expect(drawn(percent, 0.9134)).toBe(91.3);
    const option = reportChartOption(percent, EN, labels(percent, EN));
    expect(tooltipHtml(option, [{ seriesIndex: 0, dataIndex: 0, color: '#000' }])).toContain('91.3%');
    expect(renderSvg(option)).toContain('<svg');
  });

  it('every type renders in Arabic + dark, mirrored for RTL', () => {
    const types: ChartSpec['type'][] = ['bar', 'stacked', 'hbar', 'line', 'pie'];
    for (const type of types) {
      const spec: ChartSpec = { type, valueKind: 'number', categoryKind: 'text', categories: ['أ', 'ب', 'ج'], series: [{ key: 'a', values: [3, 1, 2] }, { key: 'b', values: [1, 2, null] }] };
      const option = reportChartOption(spec, AR_DARK, labels(spec, AR_DARK));
      expect(renderSvg(option), type).toContain('<svg');
      if (type === 'hbar') {
        expect((option.xAxis as AnyRecord).inverse).toBe(true);
        expect((option.yAxis as AnyRecord).position).toBe('right');
      } else if (type !== 'pie') {
        expect((option.xAxis as AnyRecord).inverse, type).toBe(true);
        expect((option.yAxis as AnyRecord).position, type).toBe('right');
      }
    }
    const tip = reportChartOption(money, AR_DARK, labels(money, AR_DARK)).tooltip as AnyRecord;
    expect(String(tip.extraCssText)).toContain('direction: rtl');
  });

  it('stacked bars share one stack; a single series has no legend', () => {
    const spec: ChartSpec = { type: 'stacked', valueKind: 'number', categoryKind: 'month', categories: ['2026-10'], series: [{ key: 'a', values: [1] }, { key: 'b', values: [2] }] };
    const option = reportChartOption(spec, EN, labels(spec, EN));
    expect(series(option).map((s) => s.stack)).toEqual(['total', 'total']);
    expect(reportChartOption(money, EN, labels(money, EN)).legend).toBeUndefined();
  });
});
