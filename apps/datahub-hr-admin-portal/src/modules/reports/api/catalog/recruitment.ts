import type { Candidate, Offer, Requisition } from '@/modules/recruitment';
import { average, countBy, daysBetween, funnelConversion, groupBy, inRange, median, offerAcceptanceRate, ratio, sum, timeToHire } from '@/modules/reports/utils/calculations';
import type { ReportRow } from '@/modules/reports/types/reports';
import { chart, col, data, fullName, item, note, sortByNumber, type LoadContext, type ReportDefinition } from './common';

/*
 * Recruitment reports — from Recruitment Management's requisitions, candidates (current and archived), interviews,
 * offers and summary, in the caller's scope (team readers: their departments' requisitions, no offers or salaries).
 * Requisition reports show the CURRENT state; candidate reports cover applications made in the date range. The
 * department of a candidate is the department of the requisition they applied to.
 */

const STAGES = ['new', 'screening', 'shortlisted', 'interview', 'assessment', 'offer', 'hired', 'rejected'] as const;
const SOURCES = ['careers-site', 'referral', 'job-board', 'linkedin', 'agency', 'university', 'other'] as const;
const remaining = (q: Requisition) => Math.max(0, q.vacancies - q.counts.hired);

/** Requisitions in the department filter, and the candidates who applied to them in the range. */
async function pipelineData(ctx: LoadContext, { archived = true } = {}) {
  const [requisitions, candidates] = await Promise.all([ctx.src.requisitions(ctx.f.departmentId), ctx.src.candidates()]);
  const byId = new Map(requisitions.map((q) => [q.id, q]));
  const applied = candidates.filter((c) => byId.has(c.requisition.id) && inRange(c.appliedAt, ctx.f.from, ctx.f.to) && (archived || !c.archived));
  return { requisitions, byId, applied };
}

const acceptedOffers = (offers: readonly Offer[]) => new Map(offers.filter((o) => o.status === 'accepted').map((o) => [o.candidate.id, o]));

export const recruitmentReports: ReportDefinition[] = [
  {
    id: 'recruitment.pipeline',
    filters: ['departmentId'],
    async load(ctx) {
      const list = (await ctx.src.requisitions(ctx.f.departmentId)).filter((q) => q.status === 'open' || q.status === 'on-hold');
      const rows = list.map((q) => ({ requisition: q.number, title: q.title, department: q.department.name, status: q.status, vacancies: q.vacancies, candidates: q.counts.candidates, active: q.counts.active, hired: q.counts.hired, remaining: remaining(q) }));
      rows.sort(sortByNumber('candidates'));
      return data({
        columns: [col('requisition', 'code'), col('title', 'localized'), col('department', 'localized'), col('status', 'enum', 'requisitionStatus'), col('vacancies', 'number'), col('candidates', 'number'), col('active', 'number'), col('hired', 'number'), col('remaining', 'number')],
        rows,
        summary: [item('requisitions', 'number', list.length), item('activeCandidates', 'number', sum(list.map((q) => q.counts.active))), item('openPositions', 'number', sum(list.filter((q) => q.status === 'open').map(remaining)))],
        chart: chart('hbar', 'number', 'localized', rows.slice(0, 10).map((r) => r.title), [{ key: 'active', values: rows.slice(0, 10).map((r) => r.active) }]),
        basis: [note('currentState'), note('openAndOnHold')],
      });
    },
  },
  {
    id: 'recruitment.by-stage',
    filters: ['dateRange', 'departmentId'],
    async load(ctx) {
      const { applied } = await pipelineData(ctx, { archived: false });
      const counts = countBy(applied, (c) => c.stage);
      const rows = STAGES.map((stage) => ({ stage, candidates: counts[stage] ?? 0, share: ratio(counts[stage] ?? 0, applied.length) }));
      return data({
        columns: [col('stage', 'enum', 'candidateStage'), col('candidates', 'number'), col('share', 'percent')],
        rows,
        summary: [item('candidates', 'number', applied.length), item('inInterview', 'number', counts.interview ?? 0), item('hired', 'number', counts.hired ?? 0)],
        chart: chart('bar', 'number', 'enum', [...STAGES], [{ key: 'candidates', values: rows.map((r) => r.candidates) }], 'candidateStage'),
        basis: [note('appliedInRange'), note('archivedExcluded')],
      });
    },
  },
  {
    id: 'recruitment.by-source',
    filters: ['dateRange', 'departmentId'],
    async load(ctx) {
      const { applied } = await pipelineData(ctx);
      const rows = SOURCES.map((source) => {
        const g = applied.filter((c) => c.source === source);
        const hired = g.filter((c) => c.stage === 'hired').length;
        return { source, candidates: g.length, hired, conversionRate: ratio(hired, g.length) };
      });
      return data({
        columns: [col('source', 'enum', 'candidateSource'), col('candidates', 'number'), col('hired', 'number'), col('conversionRate', 'percent')],
        rows,
        summary: [item('candidates', 'number', applied.length), item('hired', 'number', sum(rows.map((r) => r.hired))), item('conversionRate', 'percent', ratio(sum(rows.map((r) => r.hired)), applied.length))],
        chart: chart('bar', 'number', 'enum', [...SOURCES], [{ key: 'candidates', values: rows.map((r) => r.candidates) }, { key: 'hired', values: rows.map((r) => r.hired) }], 'candidateSource'),
        basis: [note('appliedInRange'), note('conversionFormula'), note('archivedIncluded')],
      });
    },
  },
  {
    id: 'recruitment.open-positions',
    filters: ['departmentId'],
    async load(ctx) {
      const list = (await ctx.src.requisitions(ctx.f.departmentId)).filter((q) => q.status === 'open');
      const rows = list
        .map((q) => ({ requisition: q.number, title: q.title, department: q.department.name, location: q.location.name, employmentType: q.employmentType, vacancies: q.vacancies, hired: q.counts.hired, remaining: remaining(q), openingDate: q.openingDate, daysOpen: Math.max(0, daysBetween(q.openingDate, ctx.today)) }))
        .sort(sortByNumber('daysOpen'));
      return data({
        columns: [col('requisition', 'code'), col('title', 'localized'), col('department', 'localized'), col('location', 'localized'), col('employmentType', 'enum', 'employmentType'), col('vacancies', 'number'), col('hired', 'number'), col('remaining', 'number'), col('openingDate', 'date'), col('daysOpen', 'number')],
        rows,
        summary: [item('openRequisitions', 'number', list.length), item('openPositions', 'number', sum(list.map(remaining))), item('averageDaysOpen', 'decimal', average(rows.map((r) => r.daysOpen)))],
        basis: [note('openPositionsFormula'), note('currentState')],
      });
    },
  },
  {
    id: 'recruitment.hiring-by-department',
    filters: ['departmentId'],
    async load(ctx) {
      const list = await ctx.src.requisitions(ctx.f.departmentId);
      const rows = [...groupBy(list, (q) => q.department.id).values()].map((g) => ({
        department: g[0]!.department.name,
        requisitions: g.length,
        open: g.filter((q) => q.status === 'open').length,
        vacancies: sum(g.filter((q) => q.status !== 'cancelled' && q.status !== 'draft').map((q) => q.vacancies)),
        candidates: sum(g.map((q) => q.counts.candidates)),
        hired: sum(g.map((q) => q.counts.hired)),
      }));
      rows.sort(sortByNumber('hired'));
      return data({
        columns: [col('department', 'localized'), col('requisitions', 'number'), col('open', 'number'), col('vacancies', 'number'), col('candidates', 'number'), col('hired', 'number')],
        rows,
        summary: [item('requisitions', 'number', list.length), item('hired', 'number', sum(rows.map((r) => r.hired)))],
        chart: chart('hbar', 'number', 'localized', rows.map((r) => r.department), [{ key: 'hired', values: rows.map((r) => r.hired) }]),
        basis: [note('currentState'), note('requisitionDepartment')],
      });
    },
  },
  {
    id: 'recruitment.interviews',
    filters: ['dateRange', 'departmentId'],
    async load(ctx) {
      const [requisitions, interviews] = await Promise.all([ctx.src.requisitions(ctx.f.departmentId), ctx.src.interviews()]);
      const ids = new Set(requisitions.map((q) => q.id));
      const list = interviews.filter((i) => ids.has(i.requisition.id) && inRange(i.start, ctx.f.from, ctx.f.to));
      const types = ['phone', 'video', 'in-person', 'technical', 'hr', 'final'] as const;
      const rows = types.map((type) => {
        const g = list.filter((i) => i.type === type);
        const feedback = g.flatMap((i) => i.feedback);
        const rec = countBy(feedback, (f) => f.recommendation);
        return { type, interviews: g.length, scheduled: g.filter((i) => i.status === 'scheduled').length, completed: g.filter((i) => i.status === 'completed').length, cancelled: g.filter((i) => i.status === 'cancelled').length, noShow: g.filter((i) => i.status === 'no-show').length, strongHire: rec['strong-hire'] ?? 0, hire: rec.hire ?? 0, hold: rec.hold ?? 0, reject: rec.reject ?? 0 };
      });
      const recKeys = ['strongHire', 'hire', 'hold', 'reject'] as const;
      return data({
        columns: [col('type', 'enum', 'interviewType'), col('interviews', 'number'), col('scheduled', 'number'), col('completed', 'number'), col('cancelled', 'number'), col('noShow', 'number'), ...recKeys.map((k) => col(k, 'number'))],
        rows,
        summary: [item('interviews', 'number', list.length), item('completed', 'number', sum(rows.map((r) => r.completed))), item('noShow', 'number', sum(rows.map((r) => r.noShow)))],
        chart: chart('pie', 'number', 'enum', [...recKeys], [{ key: 'feedback', values: recKeys.map((k) => sum(rows.map((r) => r[k]))) }], 'recommendation'),
        basis: [note('interviewsInRange'), note('recommendationsFromFeedback')],
        limitations: ctx.access.scopes.recruitment === 'team' ? [note('feedbackOwnOnly')] : [],
      });
    },
  },
  {
    id: 'recruitment.offers',
    filters: ['dateRange', 'departmentId'],
    requires: (a) => a.offers,
    async load(ctx) {
      const [requisitions, offers] = await Promise.all([ctx.src.requisitions(ctx.f.departmentId), ctx.src.offers()]);
      const ids = new Set(requisitions.map((q) => q.id));
      const list = offers.filter((o) => ids.has(o.requisition.id) && inRange(o.createdAt, ctx.f.from, ctx.f.to));
      const statuses = ['draft', 'sent', 'accepted', 'rejected', 'expired', 'withdrawn'] as const;
      const rows = statuses.map((status) => ({ status, offers: list.filter((o) => o.status === status).length }));
      return data({
        columns: [col('status', 'enum', 'offerStatus'), col('offers', 'number')],
        rows,
        summary: [item('offers', 'number', list.length), item('accepted', 'number', rows[2]!.offers), item('offerAcceptanceRate', 'percent', offerAcceptanceRate(list.map((o) => o.status)))],
        chart: chart('pie', 'number', 'enum', [...statuses], [{ key: 'offers', values: rows.map((r) => r.offers) }], 'offerStatus'),
        basis: [note('offersCreatedInRange'), note('acceptanceFormula'), note('noSalaries')],
      });
    },
  },
  {
    id: 'recruitment.time-to-hire',
    filters: ['dateRange', 'departmentId'],
    requires: (a) => a.offers,
    async load(ctx) {
      const [{ byId }, candidates, offers] = await Promise.all([pipelineData(ctx), ctx.src.candidates(), ctx.src.offers()]);
      const accepted = acceptedOffers(offers);
      const hired = candidates.filter((c: Candidate) => c.stage === 'hired' && byId.has(c.requisition.id));
      const rows: ReportRow[] = [];
      let missing = 0;
      for (const c of hired) {
        const acceptedAt = accepted.get(c.id)?.respondedAt ?? null;
        if (acceptedAt && !inRange(acceptedAt, ctx.f.from, ctx.f.to)) continue;
        const days = timeToHire(c.appliedAt, acceptedAt);
        if (days === null) {
          missing++;
          continue;
        }
        rows.push({ candidate: c.number, name: fullName(c.name), requisition: c.requisition.title, department: byId.get(c.requisition.id)!.department.name, appliedAt: c.appliedAt, acceptedAt: acceptedAt!.slice(0, 10), daysToHire: days });
      }
      rows.sort((a, b) => String(b.acceptedAt).localeCompare(String(a.acceptedAt)));
      const days = rows.map((r) => r.daysToHire as number);
      const byDept = [...groupBy(rows, (r) => JSON.stringify(r.department)).values()].map((g) => ({ department: g[0]!.department, days: average(g.map((r) => r.daysToHire as number)) }));
      return data({
        columns: [col('candidate', 'code'), col('name', 'localized'), col('requisition', 'localized'), col('department', 'localized'), col('appliedAt', 'date'), col('acceptedAt', 'date'), col('daysToHire', 'number')],
        rows,
        summary: [item('hires', 'number', rows.length), item('averageDaysToHire', 'decimal', average(days)), item('medianDaysToHire', 'decimal', median(days))],
        chart: chart('hbar', 'number', 'localized', byDept.map((d) => d.department ?? null), [{ key: 'averageDaysToHire', values: byDept.map((d) => d.days) }]),
        basis: [note('timeToHireFormula')],
        limitations: missing ? [note('missingHireDates', { n: missing })] : [],
      });
    },
  },
  {
    id: 'recruitment.conversion',
    filters: [],
    async load(ctx) {
      const summary = await ctx.src.recruitmentSummary();
      const counts = summary.funnel.map((s) => s.count);
      const step = funnelConversion(counts);
      const rows = summary.funnel.map((s, i) => ({ step: s.step, candidates: s.count, fromPrevious: step[i] ?? null, fromApplied: ratio(s.count, counts[0] ?? 0) }));
      return data({
        columns: [col('step', 'enum', 'funnelStep'), col('candidates', 'number'), col('fromPrevious', 'percent'), col('fromApplied', 'percent')],
        rows,
        summary: [item('applied', 'number', counts[0] ?? 0), item('hired', 'number', counts.at(-1) ?? 0), item('conversionRate', 'percent', ratio(counts.at(-1) ?? 0, counts[0] ?? 0))],
        chart: chart('bar', 'number', 'enum', summary.funnel.map((s) => s.step), [{ key: 'candidates', values: counts }], 'funnelStep'),
        basis: [note('funnelFromHistory'), note('conversionStepFormula')],
        limitations: [note('funnelAllTime')],
      });
    },
  },
  {
    id: 'recruitment.candidate-to-employee',
    filters: ['dateRange', 'departmentId'],
    async load(ctx) {
      const { applied, byId } = await pipelineData(ctx);
      const hired = applied.filter((c) => c.stage === 'hired');
      const rows = hired.map((c) => ({ candidate: c.number, name: fullName(c.name), requisition: c.requisition.title, department: byId.get(c.requisition.id)!.department.name, appliedAt: c.appliedAt, conversion: c.employeeId ? 'converted' : 'not-converted' }));
      const converted = hired.filter((c) => c.employeeId).length;
      return data({
        columns: [col('candidate', 'code'), col('name', 'localized'), col('requisition', 'localized'), col('department', 'localized'), col('appliedAt', 'date'), col('conversion', 'enum', 'conversionState')],
        rows,
        summary: [item('applied', 'number', applied.length), item('hired', 'number', hired.length), item('converted', 'number', converted), item('candidateToEmployeeRate', 'percent', ratio(converted, applied.length))],
        chart: chart('pie', 'number', 'enum', ['converted', 'not-converted'], [{ key: 'candidates', values: [converted, hired.length - converted] }], 'conversionState'),
        basis: [note('appliedInRange'), note('candidateToEmployeeFormula')],
      });
    },
  },
];
