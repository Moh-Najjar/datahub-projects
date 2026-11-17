import Box from '@mui/material/Box';
import type { EChartsOption } from 'echarts';
// The ESM build: its `export default` is the component itself (the CommonJS `lib/core` arrives as a
// `{ default }` wrapper in the production bundle, which React cannot render).
import ReactEChartsCore from 'echarts-for-react/esm/core';
import { echarts } from './echarts';

/**
 * One Apache ECharts chart. Fills its container's width and resizes with it: echarts-for-react's
 * `autoResize` watches the container with ResizeObserver (via size-sensor). `notMerge` replaces the whole
 * option, so theme or language changes never leave stale styles behind.
 *
 * Always `dir="ltr"`: ECharts positions SVG text assuming LTR anchoring; inheriting the page's RTL direction
 * flips `text-anchor` and misplaces labels. RTL layout is done explicitly in the option builders instead
 * (and tooltips set their own direction).
 */
export function EChart({ option, height, label }: { option: EChartsOption; height: number | Record<string, number>; label: string }) {
  return (
    <Box role="img" aria-label={label} dir="ltr" sx={{ height, width: '100%', minWidth: 0 }}>
      <ReactEChartsCore echarts={echarts} option={option} notMerge autoResize opts={{ renderer: 'svg' }} style={{ height: '100%', width: '100%' }} />
    </Box>
  );
}
