import { ApiError } from '@/core/api/types';
import { mockRequest } from '@/core/api/mock/mockRequest';
import i18n from '@/i18n';
import type { Locale } from '@/i18n/languages';
import * as saved from '@/modules/reports/mock/savedReportsMock';
import {
  BUILDER_DATASETS,
  type BuilderConfig,
  type CsvExport,
  type ExecutiveDashboard,
  type ReportCategory,
  type ReportFilters,
  type ReportId,
  type ReportResult,
  type ReportsCaller,
  type ReportsOverview,
  type SavedReport,
  type SavedReportInput,
} from '@/modules/reports/types/reports';
import { categoryOf, reportAccess, type ReportAccess } from '@/modules/reports/utils/access';
import { buildCustom, builderErrors } from '@/modules/reports/utils/builder';
import { today } from '@/modules/reports/utils/calculations';
import { buildCsv } from '@/modules/reports/utils/csv';
import { appliedFilters, defaultFilters, filterErrors, relevantFilters } from '@/modules/reports/utils/filters';
import { INSIGHT_FILTERS, REPORTS } from './catalog';
import type { LoadContext } from './catalog/common';
import { loadDepartmentComparison, loadExecutive, loadOverview } from './catalog/overview';
import { sources } from './sources';

/*
 * The Reports & Analytics API service — the module's only data entry point (components → hooks → this service →
 * the source modules' API services). It holds NO dataset of its own: each call validates the filters, checks the
 * caller's access (derived from the role, as the backend would from the token — FORBIDDEN otherwise), then computes the
 * report from the source APIs in the caller's scope. Only saved report CONFIGURATIONS are stored (simulated).
 * A real backend would run the same reports server-side; this contract stays the same.
 */

type Signal = AbortSignal | undefined;

const forbidden = () => new ApiError('FORBIDDEN', 'This report is not available to you');
function validate(filters: ReportFilters) {
  const errors = filterErrors(filters);
  if (Object.keys(errors).length) throw new ApiError('VALIDATION', 'Invalid report filters', errors);
}
function context(access: ReportAccess, filters: ReportFilters, signal: Signal): LoadContext {
  return { access, src: sources(access, signal), f: filters, today: today() };
}

/** Can the caller run this catalogue report (category access + the report's own requirement)? */
export function canRunReport(access: ReportAccess, id: ReportId): boolean {
  const def = REPORTS.get(id);
  if (!def) return false;
  return access.categories.has(categoryOf(id) as ReportCategory) && (def.requires?.(access) ?? true);
}

async function runReport(id: ReportId, filters: ReportFilters, caller: ReportsCaller, signal: Signal, category?: ReportCategory): Promise<ReportResult> {
  const def = REPORTS.get(id);
  if (!def) throw new ApiError('NOT_FOUND', 'Unknown report');
  const access = reportAccess(caller);
  if ((category && categoryOf(id) !== category) || !canRunReport(access, id)) throw forbidden();
  validate(filters);
  const f = relevantFilters(filters, def.filters);
  const result = await def.load(context(access, f, signal));
  // Only the declared columns leave the API (helper fields of a loader never reach the client or an export).
  const rows = result.rows.map((row) => Object.fromEntries(result.columns.map((c) => [c.key, row[c.key] ?? null])));
  return { ...result, rows, id, category: categoryOf(id) as ReportCategory, filters: appliedFilters(f, def.filters), generatedAt: new Date().toISOString() };
}

async function runCustom(config: BuilderConfig, caller: ReportsCaller, signal: Signal): Promise<ReportResult> {
  if (!(BUILDER_DATASETS as readonly string[]).includes(config.dataset)) throw new ApiError('VALIDATION', 'Unknown dataset', { dataset: ['notAllowed'] });
  const base = await runReport(config.dataset, config.filters, caller, signal);
  const errors = builderErrors(config, base.columns);
  if (Object.keys(errors).length) throw new ApiError('VALIDATION', 'Invalid report configuration', errors);
  const { columns, rows } = buildCustom(config, base.columns, base.rows);
  return { ...base, columns, rows, chart: null, summary: [{ key: 'rows', kind: 'number', value: rows.length }], basis: [{ key: 'builderDataset' }, ...base.basis] };
}

const category = (c: ReportCategory) => (id: ReportId, filters: ReportFilters, caller: ReportsCaller, signal?: Signal) => runReport(id, filters, caller, signal, c);

/** CSV of a report or builder configuration: every matching record the caller may see, headings in `language`. */
export type ExportRequest =
  | { kind: 'report'; reportId: ReportId; filters: ReportFilters }
  | { kind: 'custom'; config: BuilderConfig }
  | { kind: 'insights'; filters: ReportFilters }
  | { kind: 'executive'; filters: ReportFilters };

async function resultFor(request: ExportRequest, caller: ReportsCaller): Promise<ReportResult> {
  switch (request.kind) {
    case 'report':
      return runReport(request.reportId, request.filters, caller, undefined);
    case 'custom':
      return runCustom(request.config, caller, undefined);
    case 'insights':
      return reportsApi.getHRInsights(request.filters, caller);
    case 'executive': {
      const d = await reportsApi.getExecutiveDashboard(request.filters, caller);
      return { ...d.departments, id: 'executive.dashboard', category: 'executive', filters: d.filters, generatedAt: d.generatedAt };
    }
  }
}

async function exportCsv(request: ExportRequest, language: Locale, caller: ReportsCaller): Promise<CsvExport> {
  const result = await resultFor(request, caller);
  const t = i18n.getFixedT(language, 'reports');
  const content = buildCsv(result.columns, result.rows, {
    language,
    header: (c) => {
      const name = t(`labels.${c.key}` as never) as string;
      return c.kind === 'money' && result.currency ? `${name} (${result.currency})` : c.kind === 'percent' ? `${name} (%)` : c.kind === 'hours' ? `${name} (${t('units.hours')})` : name;
    },
    enumLabel: (name, value) => t(`enums.${name}.${value}` as never) as string,
  });
  const range = result.filters.from ? `_${result.filters.from}_${result.filters.to}` : `_${today()}`;
  return { fileName: `${result.id.replace('.', '-')}${range}.csv`, content, rows: result.rows.length };
}

export const reportsApi = {
  /** Departments the caller's reports cover (`null` = the whole organisation): used to offer only those in filters. */
  getReportScope: async (caller: ReportsCaller, signal?: Signal): Promise<{ departmentIds: string[] | null }> => {
    const access = reportAccess(caller);
    if (!access.tabs.size) throw forbidden();
    if (access.organization || access.scopes.employees !== 'team') return { departmentIds: null };
    const team = await sources(access, signal).employees();
    return { departmentIds: [...new Set(team.map((e) => e.department.id))] };
  },
  getReportsOverview: async (filters: ReportFilters, caller: ReportsCaller, signal?: Signal): Promise<ReportsOverview> => {
    const access = reportAccess(caller);
    if (!access.tabs.has('overview')) throw forbidden();
    validate(filters);
    const { kpis, charts } = await loadOverview(context(access, filters, signal));
    return { filters, kpis, charts, currency: 'JOD', generatedAt: new Date().toISOString() };
  },
  getEmployeeReports: category('employees'),
  getAttendanceReports: category('attendance'),
  getLeaveReports: category('leave'),
  getRecruitmentReports: category('recruitment'),
  getPerformanceReports: category('performance'),
  getPayrollReports: category('payroll'),
  getDocumentReports: category('documents'),
  /** Any catalogue report by id (the category's own operation applies the same checks). */
  getReport: (id: ReportId, filters: ReportFilters, caller: ReportsCaller, signal?: Signal) => runReport(id, filters, caller, signal),
  getHRInsights: async (filters: ReportFilters, caller: ReportsCaller, signal?: Signal): Promise<ReportResult> => {
    const access = reportAccess(caller);
    if (!access.tabs.has('insights')) throw forbidden();
    validate(filters);
    const f = relevantFilters(filters, INSIGHT_FILTERS);
    const result = await loadDepartmentComparison(context(access, f, signal));
    return { ...result, id: 'insights.departments', category: 'insights', filters: appliedFilters(f, INSIGHT_FILTERS), generatedAt: new Date().toISOString() };
  },
  getExecutiveDashboard: async (filters: ReportFilters, caller: ReportsCaller, signal?: Signal): Promise<ExecutiveDashboard> => {
    const access = reportAccess(caller);
    if (!access.tabs.has('executive')) throw forbidden();
    validate(filters);
    const f = relevantFilters(filters, INSIGHT_FILTERS);
    const result = await loadExecutive(context(access, f, signal));
    return { filters: { from: f.from, to: f.to, departmentId: f.departmentId }, ...result, currency: 'JOD', generatedAt: new Date().toISOString() };
  },
  getCustomReport: (config: BuilderConfig, caller: ReportsCaller, signal?: Signal) => runCustom(config, caller, signal),

  /* Saved report configurations (owner only). Access to the report is checked when saving. */
  getSavedReports: (caller: ReportsCaller, signal?: Signal): Promise<SavedReport[]> => mockRequest(() => saved.listSaved(caller), { signal }),
  saveReportConfiguration: async (input: SavedReportInput, caller: ReportsCaller): Promise<SavedReport> => {
    checkSavable(input, caller);
    return mockRequest(() => saved.createSaved(input, caller));
  },
  updateSavedReport: async (id: string, input: SavedReportInput, caller: ReportsCaller): Promise<SavedReport> => {
    checkSavable(input, caller);
    return mockRequest(() => saved.updateSaved(id, input, caller));
  },
  deleteSavedReport: (id: string, caller: ReportsCaller): Promise<void> => mockRequest(() => saved.deleteSaved(id, caller)),

  exportReport: exportCsv,
};

/** A configuration may be saved only for a report the caller can run, with valid filters (and builder settings). */
function checkSavable(input: SavedReportInput, caller: ReportsCaller) {
  const access = reportAccess(caller);
  validate(input.filters ?? defaultFilters());
  if (input.kind === 'report') {
    if (!input.reportId || !canRunReport(access, input.reportId)) throw forbidden();
  } else {
    if (!input.builder || !(BUILDER_DATASETS as readonly string[]).includes(input.builder.dataset)) throw new ApiError('VALIDATION', 'Invalid configuration', { builder: ['required'] });
    if (!canRunReport(access, input.builder.dataset)) throw forbidden();
    validate(input.builder.filters);
  }
}
