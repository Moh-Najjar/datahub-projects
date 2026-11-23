import type { ReviewCycle } from '@/modules/performance';
import { average, countBy, groupBy, ratingDistribution, ratio } from '@/modules/reports/utils/calculations';
import type { ReportRow } from '@/modules/reports/types/reports';
import { chart, col, data, item, note, sortByNumber, type LoadContext, type ReportDefinition } from './common';

/*
 * Performance reports — from Performance Management's cycles, reviews, goals and development plans in the caller's
 * scope (team readers: their team). Ratings are the manager reviews' overall ratings, returned by the module only when
 * the review is completed and visible to the caller; written comments, strengths and self-assessment texts are never
 * part of a report. Cycles are included when their working window overlaps the date range.
 */

const overlaps = (c: ReviewCycle, from: string, to: string) => c.startDate <= to && c.endDate >= from;

async function reviewData(ctx: LoadContext) {
  const [cycles, reviews] = await Promise.all([ctx.src.cycles(), ctx.src.reviews(ctx.f.departmentId)]);
  const inRange = cycles.filter((c) => c.status !== 'draft' && overlaps(c, ctx.f.from, ctx.f.to));
  const ids = new Set(inRange.map((c) => c.id));
  const list = reviews.filter((r) => ids.has(r.cycle.id));
  const rated = list.filter((r) => r.state === 'completed' && r.overallRating !== null);
  return { cycles: inRange, reviews: list, rated };
}

const goalsInRange = async (ctx: LoadContext) => (await ctx.src.goals(ctx.f.departmentId)).filter((g) => g.startDate <= ctx.f.to && g.dueDate >= ctx.f.from);
const BASIS = [note('cyclesOverlapping'), note('completedReviewsOnly'), note('noComments')];

export const performanceReports: ReportDefinition[] = [
  {
    id: 'performance.distribution',
    filters: ['dateRange', 'departmentId'],
    async load(ctx) {
      const { rated } = await reviewData(ctx);
      const dist = ratingDistribution(rated.map((r) => r.overallRating!));
      return data({
        columns: [col('rating', 'number'), col('reviews', 'number'), col('share', 'percent')],
        rows: dist.map((d) => ({ rating: d.value, reviews: d.count, share: ratio(d.count, rated.length) })),
        summary: [item('completedReviews', 'number', rated.length), item('averageRating', 'rating', average(rated.map((r) => r.overallRating!)))],
        chart: chart('bar', 'number', 'number', dist.map((d) => d.value), [{ key: 'reviews', values: dist.map((d) => d.count) }]),
        basis: BASIS,
        limitations: rated.length ? [] : [note('noCompletedReviews')],
      });
    },
  },
  {
    id: 'performance.by-department',
    filters: ['dateRange', 'departmentId'],
    async load(ctx) {
      const { rated } = await reviewData(ctx);
      const rows = [...groupBy(rated, (r) => r.employee.department.id).values()].map((g) => ({ department: g[0]!.employee.department.name, reviews: g.length, averageRating: average(g.map((r) => r.overallRating!)), highest: Math.max(...g.map((r) => r.overallRating!)), lowest: Math.min(...g.map((r) => r.overallRating!)) }));
      rows.sort(sortByNumber('averageRating'));
      return data({
        columns: [col('department', 'localized'), col('reviews', 'number'), col('averageRating', 'rating'), col('highest', 'number'), col('lowest', 'number')],
        rows,
        summary: [item('completedReviews', 'number', rated.length), item('averageRating', 'rating', average(rated.map((r) => r.overallRating!)))],
        chart: chart('hbar', 'rating', 'localized', rows.map((r) => r.department), [{ key: 'averageRating', values: rows.map((r) => r.averageRating) }]),
        basis: [...BASIS, note('employeeDepartment')],
        limitations: rated.length ? [] : [note('noCompletedReviews')],
      });
    },
  },
  {
    id: 'performance.completion',
    filters: ['dateRange', 'departmentId'],
    async load(ctx) {
      const { cycles, reviews } = await reviewData(ctx);
      const byCycle = groupBy(reviews, (r) => r.cycle.id);
      const rows = cycles.map((c) => {
        const g = byCycle.get(c.id) ?? [];
        const completed = g.filter((r) => r.state === 'completed').length;
        return { cycle: c.name, status: c.status, participants: g.length, selfSubmitted: g.filter((r) => r.selfStatus === 'submitted').length, managerSubmitted: g.filter((r) => r.managerStatus === 'submitted').length, completed, completionRate: ratio(completed, g.length) };
      });
      return data({
        columns: [col('cycle', 'localized'), col('status', 'enum', 'cycleStatus'), col('participants', 'number'), col('selfSubmitted', 'number'), col('managerSubmitted', 'number'), col('completed', 'number'), col('completionRate', 'percent')],
        rows,
        summary: [item('reviews', 'number', reviews.length), item('completed', 'number', reviews.filter((r) => r.state === 'completed').length), item('completionRate', 'percent', ratio(reviews.filter((r) => r.state === 'completed').length, reviews.length))],
        chart: chart('hbar', 'percent', 'localized', rows.map((r) => r.cycle), [{ key: 'completionRate', values: rows.map((r) => r.completionRate) }]),
        basis: [note('cyclesOverlapping'), note('completionFormula')],
      });
    },
  },
  {
    id: 'performance.goals-progress',
    filters: ['dateRange', 'departmentId'],
    async load(ctx) {
      const goals = (await goalsInRange(ctx)).filter((g) => g.status !== 'cancelled');
      const rows = [...groupBy(goals, (g) => g.department.id).values()].map((g) => ({ department: g[0]!.department.name, goals: g.length, averageProgress: ratio(g.reduce((s, x) => s + x.progress, 0), g.length * 100), completed: g.filter((x) => x.status === 'completed').length, atRisk: g.filter((x) => x.status === 'at-risk').length }));
      rows.sort(sortByNumber('goals'));
      return data({
        columns: [col('department', 'localized'), col('goals', 'number'), col('averageProgress', 'percent'), col('completed', 'number'), col('atRisk', 'number')],
        rows,
        summary: [item('goals', 'number', goals.length), item('averageProgress', 'percent', ratio(goals.reduce((s, x) => s + x.progress, 0), goals.length * 100)), item('completed', 'number', goals.filter((g) => g.status === 'completed').length)],
        chart: chart('hbar', 'percent', 'localized', rows.map((r) => r.department), [{ key: 'averageProgress', values: rows.map((r) => r.averageProgress) }]),
        basis: [note('goalsActiveInRange'), note('cancelledGoalsExcluded')],
      });
    },
  },
  {
    id: 'performance.goals-by-status',
    filters: ['dateRange', 'departmentId'],
    async load(ctx) {
      const goals = await goalsInRange(ctx);
      const statuses = ['not-started', 'in-progress', 'at-risk', 'completed', 'cancelled'] as const;
      const counts = countBy(goals, (g) => g.status);
      const rows = statuses.map((status) => {
        const g = goals.filter((x) => x.status === status);
        return { status, goals: counts[status] ?? 0, share: ratio(counts[status] ?? 0, goals.length), averageProgress: ratio(g.reduce((s, x) => s + x.progress, 0), g.length * 100) };
      });
      return data({
        columns: [col('status', 'enum', 'goalStatus'), col('goals', 'number'), col('share', 'percent'), col('averageProgress', 'percent')],
        rows,
        summary: [item('goals', 'number', goals.length)],
        chart: chart('pie', 'number', 'enum', [...statuses], [{ key: 'goals', values: rows.map((r) => r.goals) }], 'goalStatus'),
        basis: [note('goalsActiveInRange')],
      });
    },
  },
  {
    id: 'performance.history',
    filters: ['dateRange', 'departmentId'],
    requires: (a) => a.individualRatings,
    async load(ctx) {
      const { reviews } = await reviewData(ctx);
      const rows: ReportRow[] = reviews
        .map((r) => ({ employee: r.employee.name, employeeNumber: r.employee.employeeNumber, department: r.employee.department.name, cycle: r.cycle.name, state: r.state, overallRating: r.overallRating }))
        .sort((a, b) => String(a.employeeNumber).localeCompare(String(b.employeeNumber)));
      return data({
        columns: [col('employee', 'localized'), col('employeeNumber', 'code'), col('department', 'localized'), col('cycle', 'localized'), col('state', 'enum', 'reviewState'), col('overallRating', 'number')],
        rows,
        summary: [item('reviews', 'number', rows.length), item('completedReviews', 'number', reviews.filter((r) => r.state === 'completed').length)],
        basis: [note('cyclesOverlapping'), note('ratingVisibleOnly'), note('noComments')],
      });
    },
  },
  {
    id: 'performance.development',
    filters: ['departmentId'],
    async load(ctx) {
      const plans = await ctx.src.plans(ctx.f.departmentId);
      const rows = plans.map((p) => ({ employee: p.employee.name, employeeNumber: p.employee.employeeNumber, department: p.employee.department.name, status: p.status, activities: p.activities.length, done: p.activities.filter((a) => a.status === 'done').length, progress: p.progress / 100, targetDate: p.targetDate }));
      const statuses = ['draft', 'active', 'completed', 'cancelled'] as const;
      return data({
        columns: [col('employee', 'localized'), col('employeeNumber', 'code'), col('department', 'localized'), col('status', 'enum', 'planStatus'), col('activities', 'number'), col('done', 'number'), col('progress', 'percent'), col('targetDate', 'date')],
        rows,
        summary: [item('plans', 'number', plans.length), item('activePlans', 'number', plans.filter((p) => p.status === 'active').length), item('averageProgress', 'percent', ratio(plans.reduce((s, p) => s + p.progress, 0), plans.length * 100))],
        chart: chart('pie', 'number', 'enum', [...statuses], [{ key: 'plans', values: statuses.map((s) => plans.filter((p) => p.status === s).length) }], 'planStatus'),
        basis: [note('planProgressFormula'), note('currentState')],
      });
    },
  },
  {
    id: 'performance.cycles',
    filters: ['dateRange', 'departmentId'],
    async load(ctx) {
      const { cycles, reviews } = await reviewData(ctx);
      const byCycle = groupBy(reviews, (r) => r.cycle.id);
      const rows = [...cycles]
        .sort((a, b) => a.startDate.localeCompare(b.startDate))
        .map((c) => {
          const g = byCycle.get(c.id) ?? [];
          const rated = g.filter((r) => r.state === 'completed' && r.overallRating !== null);
          return { cycle: c.name, periodStart: c.periodStart, periodEnd: c.periodEnd, participants: g.length, completed: rated.length, completionRate: ratio(g.filter((r) => r.state === 'completed').length, g.length), averageRating: average(rated.map((r) => r.overallRating!)) };
        });
      return data({
        columns: [col('cycle', 'localized'), col('periodStart', 'date'), col('periodEnd', 'date'), col('participants', 'number'), col('completed', 'number'), col('completionRate', 'percent'), col('averageRating', 'rating')],
        rows,
        summary: [item('cycles', 'number', rows.length)],
        chart: chart('bar', 'rating', 'localized', rows.map((r) => r.cycle), [{ key: 'averageRating', values: rows.map((r) => r.averageRating) }]),
        basis: BASIS,
      });
    },
  },
];
