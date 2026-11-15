import { createElement } from 'react';
import type { EChartsOption } from 'echarts';

/**
 * Test double for `echarts-for-react/esm/core` (jsdom cannot lay out or draw charts). It records the props
 * each chart receives, so tests can assert the exact option, theme colours, RTL settings and resize config.
 * The option builders themselves are additionally rendered with the REAL ECharts engine in `options.test.ts`.
 */
export interface RecordedChartProps {
  option: EChartsOption;
  autoResize?: boolean;
  notMerge?: boolean;
  opts?: { renderer?: string };
  style?: { width?: string; height?: string };
}

export const recordedCharts: RecordedChartProps[] = [];

export function EChartsStub(props: RecordedChartProps) {
  const index = recordedCharts.push(props) - 1;
  return createElement('div', { 'data-testid': 'echarts-stub', 'data-chart-index': index });
}
