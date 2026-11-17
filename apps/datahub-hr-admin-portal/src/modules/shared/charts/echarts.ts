import { BarChart, LineChart, PieChart } from 'echarts/charts';
import { GridComponent, LegendComponent, TooltipComponent } from 'echarts/components';
import * as echarts from 'echarts/core';
import { SVGRenderer } from 'echarts/renderers';

/*
 * Apache ECharts, modular build: only the chart types and components the app uses are bundled (shared by the
 * dashboard and attendance charts; it is loaded only by the lazy pages that draw charts).
 * SVG renderer: crisp at any zoom, real text nodes (correct Arabic shaping), light for small datasets.
 */
echarts.use([LineChart, PieChart, BarChart, GridComponent, TooltipComponent, LegendComponent, SVGRenderer]);

export { echarts };
