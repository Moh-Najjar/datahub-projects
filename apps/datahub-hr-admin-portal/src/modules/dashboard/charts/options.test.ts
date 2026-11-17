import type { EChartsOption } from 'echarts';
import { describe, expect, it } from 'vitest';
import { chartColors } from '@/core/theme/tokens';
import * as mock from '@/modules/dashboard/mock/dashboardMock';
import { echarts } from '@/modules/shared/charts/echarts';
import { attendanceOption, departmentOption, employeeGrowthOption, formatMonth, leaveOption, type ChartContext } from './options';

const NOW = new Date('2026-06-15T10:30:00');
const EN_LTR: ChartContext = { mode: 'light', direction: 'ltr', language: 'en' };
const AR_RTL: ChartContext = { mode: 'light', direction: 'rtl', language: 'ar' };
const AR_DARK: ChartContext = { mode: 'dark', direction: 'rtl', language: 'ar' };

const growth = mock.employeeGrowth('organization', NOW);
const attendance = mock.attendanceOverview('organization', NOW);
const departments = mock.departmentHeadcount();
const leave = mock.leaveOverview('organization', NOW);

const growthLabels = { headcount: 'Headcount', previousYear: 'Same month last year' };
const attendanceLabels = { present: 'Present', late: 'Late', absent: 'Absent', onLeave: 'On leave' };
const leaveLabels = { pending: 'Pending', approved: 'Approved', rejected: 'Rejected', cancelled: 'Cancelled', total: 'Total' };

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
const axis = (value: unknown) => value as AnyRecord;

describe('employee growth (line)', () => {
  it('plots headcount and previous year for the 12 months', () => {
    const option = employeeGrowthOption(growth, EN_LTR, growthLabels);
    expect(series(option)[0]!.data).toEqual(growth.months.map((m) => m.headcount));
    expect(series(option)[1]!.data).toEqual(growth.months.map((m) => m.previousYear));
    expect(axis(option.xAxis).data).toEqual(growth.months.map((m) => m.month));
  });

  it('mirrors for RTL: months run right-to-left, value axis on the right', () => {
    expect(axis(employeeGrowthOption(growth, EN_LTR, growthLabels).xAxis).inverse).toBe(false);
    const rtl = employeeGrowthOption(growth, AR_RTL, growthLabels);
    expect(axis(rtl.xAxis).inverse).toBe(true);
    expect(axis(rtl.yAxis).position).toBe('right');
  });

  it('uses the theme tokens for the active colour scheme', () => {
    expect(employeeGrowthOption(growth, EN_LTR, growthLabels).color).toEqual([chartColors.light.blue, chartColors.light.reference]);
    expect(employeeGrowthOption(growth, AR_DARK, growthLabels).color).toEqual([chartColors.dark.blue, chartColors.dark.reference]);
  });

  it('renders with ECharts, with Arabic month labels and Latin digits', () => {
    const svg = renderSvg(employeeGrowthOption(growth, AR_RTL, { headcount: 'عدد الموظفين', previousYear: 'الشهر نفسه من العام الماضي' }));
    // ECharts thins crowded axis labels automatically; the first category label is always drawn.
    expect(svg).toContain(formatMonth(growth.months[0]!.month, 'ar'));
    expect(svg).toContain('عدد الموظفين');
    expect(svg).not.toMatch(/[٠-٩]/);
  });
});

describe('attendance (doughnut)', () => {
  it('has the four groups with values and theme colours', () => {
    const data = series(attendanceOption(attendance, EN_LTR, attendanceLabels))[0]!.data as Array<{ name: string; value: number; itemStyle: { color: string } }>;
    expect(data.map((d) => [d.name, d.value])).toEqual([
      ['Present', attendance.present],
      ['Late', attendance.late],
      ['Absent', attendance.absent],
      ['On leave', attendance.onLeave],
    ]);
    expect(data[0]!.itemStyle.color).toBe(chartColors.light.green);
  });

  it('legend shows value and percentage; RTL reverses the order', () => {
    const option = attendanceOption(attendance, EN_LTR, attendanceLabels);
    const legend = option.legend as { formatter: (name: string) => string; data: string[] };
    const total = attendance.present + attendance.late + attendance.absent + attendance.onLeave;
    expect(legend.formatter('Present')).toContain(new Intl.NumberFormat('en-GB', { style: 'percent', maximumFractionDigits: 1 }).format(attendance.present / total));
    expect((attendanceOption(attendance, AR_RTL, attendanceLabels).legend as { data: string[] }).data).toEqual([...legend.data].reverse());
  });

  it('RTL legend text puts the name rightmost (charts draw text left-to-right)', () => {
    const ar = { present: 'حاضر', late: 'متأخر', absent: 'غائب', onLeave: 'في إجازة' };
    const legend = attendanceOption(attendance, AR_RTL, ar).legend as { formatter: (name: string) => string };
    expect(legend.formatter('حاضر').endsWith('حاضر')).toBe(true);
    expect((attendanceOption(attendance, EN_LTR, attendanceLabels).legend as { formatter: (name: string) => string }).formatter('Present').startsWith('Present')).toBe(true);
  });

  it('renders with ECharts', () => {
    expect(renderSvg(attendanceOption(attendance, AR_DARK, { present: 'حاضر', late: 'متأخر', absent: 'غائب', onLeave: 'في إجازة' }))).toContain('حاضر');
  });
});

describe('departments (horizontal bars)', () => {
  it('lists departments largest first with localized names', () => {
    const option = departmentOption(departments, AR_RTL, 'الموظفون');
    expect(axis(option.yAxis).data).toEqual(departments.departments.map((d) => d.name.ar));
    expect(series(option)[0]!.data).toEqual(departments.departments.map((d) => d.headcount));
  });

  it('mirrors for RTL: categories on the right, bars grow leftwards', () => {
    const ltr = departmentOption(departments, EN_LTR, 'Employees');
    const rtl = departmentOption(departments, AR_RTL, 'الموظفون');
    expect([axis(ltr.yAxis).position, axis(ltr.xAxis).inverse]).toEqual(['left', false]);
    expect([axis(rtl.yAxis).position, axis(rtl.xAxis).inverse]).toEqual(['right', true]);
  });

  it('renders with ECharts, Arabic department names included', () => {
    expect(renderSvg(departmentOption(departments, AR_RTL, 'الموظفون'))).toContain('الهندسة');
  });
});

describe('leave requests (stacked bars)', () => {
  it('stacks the four statuses per month', () => {
    const option = leaveOption(leave, EN_LTR, leaveLabels);
    const s = series(option);
    expect(s.map((x) => x.name)).toEqual(['Approved', 'Pending', 'Rejected', 'Cancelled']);
    expect(new Set(s.map((x) => x.stack))).toEqual(new Set(['requests']));
    expect(s[1]!.data).toEqual(leave.months.map((m) => m.pending));
  });

  it('renders with ECharts in both directions', () => {
    expect(renderSvg(leaveOption(leave, EN_LTR, leaveLabels))).toContain('Approved');
    expect(renderSvg(leaveOption(leave, AR_RTL, { ...leaveLabels, approved: 'موافق عليها' }))).toContain('موافق عليها');
  });
});
