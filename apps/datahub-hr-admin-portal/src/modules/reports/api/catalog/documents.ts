import type { DocumentSummary, EmployeeCompliance } from '@/modules/documents';
import { complianceRate, daysBetween, groupBy, ratio, sum } from '@/modules/reports/utils/calculations';
import type { ReportNote, ReportRow } from '@/modules/reports/types/reports';
import { chart, col, data, item, label, note, sortByNumber, type ReportDefinition } from './common';

/*
 * Document reports — from Documents Management (the single source of truth for documents) in the caller's scope:
 * current employee documents (archived and superseded excluded), its expiry lists and its required-documents
 * checklist. Statuses, expiry and compliance are the module's. HIGHLY CONFIDENTIAL documents (identity, medical…)
 * never appear in a row-level report, and aggregates show them only as one "Restricted categories" group.
 */

const restricted = (d: DocumentSummary) => d.confidentiality === 'highly-confidential';

/** Rows for the list reports (restricted documents left out, and counted in a limitation). */
function documentRows(list: readonly DocumentSummary[], extra: (d: DocumentSummary) => ReportRow = () => ({})) {
  const visible = list.filter((d) => !restricted(d));
  const rows: ReportRow[] = visible.map((d) => ({ reference: d.reference, category: d.category.name, owner: d.owner.name, ownerNumber: d.owner.number, department: d.owner.department?.name ?? null, ...extra(d) }));
  const hidden = list.length - visible.length;
  const notes: ReportNote[] = hidden ? [note('restrictedHidden', { n: hidden })] : [];
  return { rows, notes, total: list.length };
}
const listColumns = [col('reference', 'code'), col('category', 'localized'), col('owner', 'localized'), col('ownerNumber', 'code'), col('department', 'localized')];

/** Compliance items (one per employee × applicable rule), from the module's checklist. */
const itemsOf = (list: readonly EmployeeCompliance[]) => list.flatMap((e) => e.items);
const BASIS = [note('currentDocuments'), note('employeeDocumentsOnly')];

export const documentReports: ReportDefinition[] = [
  {
    id: 'documents.by-category',
    filters: ['departmentId'],
    async load(ctx) {
      const list = await ctx.src.documents({ departmentId: ctx.f.departmentId });
      const groups = groupBy(list, (d) => (restricted(d) ? 'restricted' : d.category.id));
      const rows = [...groups.entries()].map(([key, g]) => ({
        category: key === 'restricted' ? label('enums.restricted.categories') : g[0]!.category.name,
        documents: g.length,
        verified: g.filter((d) => d.status === 'verified').length,
        pendingReview: g.filter((d) => d.status === 'pending-review').length,
        expiringSoon: g.filter((d) => d.expiryStatus === 'expiring-soon').length,
        expired: g.filter((d) => d.status === 'expired').length,
      }));
      rows.sort(sortByNumber('documents'));
      return data({
        columns: [col('category', 'localized'), col('documents', 'number'), col('verified', 'number'), col('pendingReview', 'number'), col('expiringSoon', 'number'), col('expired', 'number')],
        rows,
        summary: [item('documents', 'number', list.length), item('categories', 'number', rows.length)],
        chart: chart('hbar', 'number', 'localized', rows.slice(0, 12).map((r) => r.category), [{ key: 'documents', values: rows.slice(0, 12).map((r) => r.documents) }]),
        basis: [...BASIS, note('restrictedGrouped')],
      });
    },
  },
  {
    id: 'documents.by-department',
    filters: ['departmentId'],
    async load(ctx) {
      const list = await ctx.src.documents({ departmentId: ctx.f.departmentId });
      const rows = [...groupBy(list, (d) => d.owner.department?.id ?? '').values()].map((g) => ({
        department: g[0]!.owner.department?.name ?? null,
        documents: g.length,
        employees: new Set(g.map((d) => d.owner.id)).size,
        verified: g.filter((d) => d.status === 'verified').length,
        pendingReview: g.filter((d) => d.status === 'pending-review').length,
        expiringSoon: g.filter((d) => d.expiryStatus === 'expiring-soon').length,
        expired: g.filter((d) => d.status === 'expired').length,
      }));
      rows.sort(sortByNumber('documents'));
      return data({
        columns: [col('department', 'localized'), col('documents', 'number'), col('employees', 'number'), col('verified', 'number'), col('pendingReview', 'number'), col('expiringSoon', 'number'), col('expired', 'number')],
        rows,
        summary: [item('documents', 'number', list.length), item('expired', 'number', list.filter((d) => d.status === 'expired').length)],
        chart: chart('hbar', 'number', 'localized', rows.map((r) => r.department), [{ key: 'verified', values: rows.map((r) => r.verified) }, { key: 'pendingReview', values: rows.map((r) => r.pendingReview) }, { key: 'expired', values: rows.map((r) => r.expired) }]),
        basis: [...BASIS, note('ownerDepartment')],
      });
    },
  },
  {
    id: 'documents.expired',
    filters: ['departmentId'],
    async load(ctx) {
      const { rows, notes, total } = documentRows(await ctx.src.expiredDocuments(ctx.f.departmentId), (d) => ({ expiryDate: d.expiryDate, daysOverdue: d.daysRemaining === null ? null : -d.daysRemaining }));
      rows.sort(sortByNumber('daysOverdue'));
      return data({ columns: [...listColumns, col('expiryDate', 'date'), col('daysOverdue', 'number')], rows, summary: [item('expired', 'number', total)], basis: [note('expiredDefinition'), note('currentState')], limitations: notes });
    },
  },
  {
    id: 'documents.expiring',
    filters: ['departmentId'],
    async load(ctx) {
      const threshold = (await ctx.src.documentsOverview()).expiry.thresholdDays;
      const window = threshold <= 7 ? '7' : threshold <= 30 ? '30' : threshold <= 60 ? '60' : '90';
      const { rows, notes, total } = documentRows(await ctx.src.expiringDocuments(window, ctx.f.departmentId), (d) => ({ expiryDate: d.expiryDate, daysRemaining: d.daysRemaining }));
      rows.sort((a, b) => ((a.daysRemaining as number) ?? 0) - ((b.daysRemaining as number) ?? 0));
      return data({ columns: [...listColumns, col('expiryDate', 'date'), col('daysRemaining', 'number')], rows, summary: [item('expiringSoon', 'number', total), item('windowDays', 'number', Number(window))], basis: [note('expiringWindow', { days: Number(window) }), note('currentState')], limitations: notes });
    },
  },
  {
    id: 'documents.pending',
    filters: ['departmentId'],
    async load(ctx) {
      const { rows, notes, total } = documentRows(await ctx.src.documents({ departmentId: ctx.f.departmentId, status: 'pending-review' }), (d) => ({ uploadedAt: d.uploadedAt.slice(0, 10), waitingDays: Math.max(0, daysBetween(d.uploadedAt, ctx.today)) }));
      rows.sort(sortByNumber('waitingDays'));
      return data({ columns: [...listColumns, col('uploadedAt', 'date'), col('waitingDays', 'number')], rows, summary: [item('pendingReview', 'number', total)], basis: [note('currentState')], limitations: notes });
    },
  },
  {
    id: 'documents.verified',
    filters: ['departmentId'],
    async load(ctx) {
      const { rows, notes, total } = documentRows(await ctx.src.documents({ departmentId: ctx.f.departmentId, status: 'verified' }), (d) => ({ issueDate: d.issueDate, expiryDate: d.expiryDate }));
      return data({ columns: [...listColumns, col('issueDate', 'date'), col('expiryDate', 'date')], rows, summary: [item('verified', 'number', total)], basis: [note('verifiedNotExpired'), note('currentState')], limitations: notes });
    },
  },
  {
    id: 'documents.missing',
    filters: ['departmentId'],
    async load(ctx) {
      const list = await ctx.src.compliance(ctx.f.departmentId);
      const rows = list.flatMap((e) =>
        e.items
          .filter((i) => i.status === 'missing' || i.status === 'required' || i.status === 'expired')
          .map((i) => ({ employee: e.employee.name, employeeNumber: e.employee.employeeNumber, department: e.employee.department.name, requirement: i.rule.name, status: i.status, dueDate: i.dueDate })),
      );
      return data({
        columns: [col('employee', 'localized'), col('employeeNumber', 'code'), col('department', 'localized'), col('requirement', 'localized'), col('status', 'enum', 'complianceStatus'), col('dueDate', 'date')],
        rows,
        summary: [item('missing', 'number', rows.filter((r) => r.status === 'missing').length), item('withinGracePeriod', 'number', rows.filter((r) => r.status === 'required').length), item('expired', 'number', rows.filter((r) => r.status === 'expired').length), item('employeesAffected', 'number', new Set(rows.map((r) => r.employeeNumber)).size)],
        basis: [note('requiredRules'), note('gracePeriod')],
      });
    },
  },
  {
    id: 'documents.compliance-by-department',
    filters: ['departmentId'],
    async load(ctx) {
      const list = await ctx.src.compliance(ctx.f.departmentId);
      const rows = [...groupBy(list, (e) => e.employee.department.id).values()].map((g) => {
        const items = itemsOf(g);
        return { department: g[0]!.employee.department.name, employees: g.length, requirements: items.length, verified: items.filter((i) => i.status === 'verified').length, fullyCompliant: g.filter((e) => e.completeness === 100).length, complianceRate: complianceRate(items) };
      });
      rows.sort(sortByNumber('employees'));
      return data({
        columns: [col('department', 'localized'), col('employees', 'number'), col('requirements', 'number'), col('verified', 'number'), col('fullyCompliant', 'number'), col('complianceRate', 'percent')],
        rows,
        summary: [item('employees', 'number', list.length), item('complianceRate', 'percent', complianceRate(itemsOf(list))), item('fullyCompliant', 'number', list.filter((e) => e.completeness === 100).length)],
        chart: chart('hbar', 'percent', 'localized', rows.map((r) => r.department), [{ key: 'complianceRate', values: rows.map((r) => r.complianceRate) }]),
        basis: [note('complianceFormula'), note('requiredRules')],
      });
    },
  },
  {
    id: 'documents.completeness',
    filters: ['departmentId'],
    async load(ctx) {
      const list = await ctx.src.compliance(ctx.f.departmentId);
      const rows = list.map((e) => ({
        employee: e.employee.name,
        employeeNumber: e.employee.employeeNumber,
        department: e.employee.department.name,
        requirements: e.items.length,
        verified: e.items.filter((i) => i.status === 'verified').length,
        missing: e.items.filter((i) => i.status === 'missing').length,
        completeness: e.completeness === null ? null : e.completeness / 100,
      }));
      const bands = [
        { key: 'complete', test: (v: number) => v === 1 },
        { key: 'partial', test: (v: number) => v > 0 && v < 1 },
        { key: 'none', test: (v: number) => v === 0 },
      ];
      return data({
        columns: [col('employee', 'localized'), col('employeeNumber', 'code'), col('department', 'localized'), col('requirements', 'number'), col('verified', 'number'), col('missing', 'number'), col('completeness', 'percent')],
        rows,
        summary: [item('employees', 'number', list.length), item('averageCompleteness', 'percent', ratio(sum(rows.filter((r) => r.completeness !== null).map((r) => r.completeness!)), rows.filter((r) => r.completeness !== null).length))],
        chart: chart('pie', 'number', 'enum', bands.map((b) => b.key), [{ key: 'employees', values: bands.map((b) => rows.filter((r) => r.completeness !== null && b.test(r.completeness)).length) }], 'complianceStatus'),
        basis: [note('completenessFormula')],
        limitations: rows.some((r) => r.completeness === null) ? [note('noRulesApply')] : [],
      });
    },
  },
];
