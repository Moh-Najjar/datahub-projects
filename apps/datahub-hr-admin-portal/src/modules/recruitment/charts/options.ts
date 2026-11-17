import type { EChartsOption, XAXisComponentOption, YAXisComponentOption } from 'echarts';
import { base, grid, html, isRtl, legend, monthAxis, monthTooltip, num, palette, percent, tooltip, valueAxisStyle, valueYAxis, type ChartContext, type TooltipParam } from '@/modules/shared/charts/base';
import type { CandidateStage, FunnelStep, RecruitmentSummary } from '@/modules/recruitment/types/recruitment';

/*
 * Pure ECharts option builders for Recruitment (data + context → option), on the shared chart helpers: theme colours
 * for light/dark, Latin digits, explicit RTL mirroring (ECharts never mirrors itself).
 */

export function stageColor(ctx: ChartContext, stage: CandidateStage): string {
  const c = palette(ctx);
  return { new: c.teal, screening: c.slate, shortlisted: c.purple, interview: c.blue, assessment: c.blue, offer: c.amber, hired: c.green, rejected: c.red }[stage];
}

function horizontal(ctx: ChartContext, names: string[]): { xAxis: XAXisComponentOption; yAxis: YAXisComponentOption } {
  const c = palette(ctx);
  return {
    xAxis: { type: 'value', inverse: isRtl(ctx), ...valueAxisStyle(ctx) },
    yAxis: { type: 'category', data: names, inverse: true, position: isRtl(ctx) ? 'right' : 'left', axisLine: { lineStyle: { color: c.axisLine } }, axisTick: { show: false }, axisLabel: { color: c.mutedText, width: 140, overflow: 'truncate' } },
  };
}

const axisTooltip = (ctx: ChartContext, names: string[]) =>
  tooltip(ctx, {
    trigger: 'axis',
    axisPointer: { type: 'shadow' },
    formatter: (raw: unknown) => {
      const params = raw as TooltipParam[];
      const rows = params.map((p) => `<div><span style="display:inline-block;width:8px;height:8px;border-radius:2px;background:${p.color};margin:0 6px"></span>${html(p.seriesName)}: <b>${num(ctx, p.value)}</b></div>`).join('');
      return `<div><b>${html(names[params[0]?.dataIndex ?? 0] ?? '')}</b></div>${rows}`;
    },
  });

/** Current candidates per stage (horizontal bars in pipeline order). */
export function stageOption(byStage: RecruitmentSummary['byStage'], ctx: ChartContext, stages: readonly CandidateStage[], label: (s: CandidateStage) => string, seriesName: string): EChartsOption {
  const names = stages.map(label);
  return {
    ...base(ctx),
    grid: { ...grid, top: 12 },
    tooltip: axisTooltip(ctx, names),
    ...horizontal(ctx, names),
    series: [{ name: seriesName, type: 'bar', barMaxWidth: 20, data: stages.map((s) => ({ value: byStage[s], itemStyle: { color: stageColor(ctx, s) } })) }],
  };
}

export interface ActivityLabels {
  applications: string;
  interviews: string;
  offers: string;
  hires: string;
}

/** Last six months: applications, completed interviews, offers sent and hires. */
export function activityOption(monthly: RecruitmentSummary['monthly'], ctx: ChartContext, labels: ActivityLabels): EChartsOption {
  const c = palette(ctx);
  const months = monthly.map((m) => m.month);
  const series = [
    { name: labels.applications, color: c.teal, data: monthly.map((m) => m.applications) },
    { name: labels.interviews, color: c.blue, data: monthly.map((m) => m.interviews) },
    { name: labels.offers, color: c.amber, data: monthly.map((m) => m.offers) },
    { name: labels.hires, color: c.green, data: monthly.map((m) => m.hires) },
  ];
  const names = series.map((s) => s.name);
  return {
    ...base(ctx),
    color: series.map((s) => s.color),
    legend: { ...legend(ctx, 'top'), data: isRtl(ctx) ? [...names].reverse() : names },
    grid: { ...grid, top: 44 },
    tooltip: tooltip(ctx, { trigger: 'axis', formatter: monthTooltip(ctx, months) }),
    xAxis: monthAxis(ctx, months),
    yAxis: valueYAxis(ctx),
    series: series.map((s) => ({ name: s.name, type: 'bar', barMaxWidth: 16, data: s.data })),
  };
}

/** Candidates per requisition (in process vs hired vs closed out), largest first. */
export function requisitionOption(rows: RecruitmentSummary['byRequisition'], ctx: ChartContext, labels: { active: string; hired: string; other: string }): EChartsOption {
  const c = palette(ctx);
  const names = rows.map((r) => r.requisition.title[ctx.language]);
  const series = [
    { name: labels.active, color: c.blue, data: rows.map((r) => r.active) },
    { name: labels.hired, color: c.green, data: rows.map((r) => r.hired) },
    { name: labels.other, color: c.slate, data: rows.map((r) => r.total - r.active - r.hired) },
  ];
  const legendNames = series.map((s) => s.name);
  return {
    ...base(ctx),
    color: series.map((s) => s.color),
    legend: { ...legend(ctx, 'top'), data: isRtl(ctx) ? [...legendNames].reverse() : legendNames },
    grid: { ...grid, top: 40 },
    tooltip: axisTooltip(ctx, names),
    ...horizontal(ctx, names),
    series: series.map((s) => ({ name: s.name, type: 'bar', stack: 'candidates', barMaxWidth: 20, data: s.data })),
  };
}

/** Hiring funnel: candidates that reached each step, with the conversion from the first step. */
export function funnelOption(funnel: RecruitmentSummary['funnel'], ctx: ChartContext, label: (s: FunnelStep) => string, seriesName: string): EChartsOption {
  const c = palette(ctx);
  const names = funnel.map((f) => label(f.step));
  const first = funnel[0]?.count ?? 0;
  const colors = [c.teal, c.slate, c.blue, c.amber, c.green];
  return {
    ...base(ctx),
    grid: { ...grid, top: 12, right: isRtl(ctx) ? 8 : 64, left: isRtl(ctx) ? 64 : 8 },
    tooltip: tooltip(ctx, {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: (raw: unknown) => {
        const p = (raw as TooltipParam[])[0];
        if (!p) return '';
        return `<div><b>${html(names[p.dataIndex] ?? '')}</b></div><div>${html(seriesName)}: <b>${num(ctx, p.value)}</b> (${percent(ctx, first ? p.value / first : 0)})</div>`;
      },
    }),
    ...horizontal(ctx, names),
    series: [
      {
        name: seriesName,
        type: 'bar',
        barMaxWidth: 26,
        data: funnel.map((f, i) => ({ value: f.count, itemStyle: { color: colors[i] } })),
        label: { show: true, position: isRtl(ctx) ? 'left' : 'right', color: c.mutedText, formatter: (p: { value: unknown }) => percent(ctx, first ? Number(p.value) / first : 0) },
      },
    ],
  };
}
