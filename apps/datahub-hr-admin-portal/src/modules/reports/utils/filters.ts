import { EMPLOYEE_STATUSES, EMPLOYMENT_TYPES, type FilterField, type ReportFilters } from '@/modules/reports/types/reports';
import { addMonths, isDate, monthOf, monthStart, today } from './calculations';

/** Longest date range a report accepts (Payroll's own limit — reports never ask a module for more than it allows). */
export const MAX_RANGE_MONTHS = 24;

/** Default filters: the current month and the two before it, up to today. */
export function defaultFilters(now = today()): ReportFilters {
  return { from: monthStart(addMonths(monthOf(now), -2)), to: now, departmentId: '', locationId: '', employmentType: '', employeeStatus: '' };
}

/** Field errors (reason keys) of a filter set; empty when valid. */
export function filterErrors(f: ReportFilters): Record<string, string[]> {
  const errors: Record<string, string[]> = {};
  if (!isDate(f.from ?? '')) errors.from = ['invalidDate'];
  if (!isDate(f.to ?? '')) errors.to = ['invalidDate'];
  if (!errors.from && !errors.to) {
    if (f.to < f.from) errors.to = ['endBeforeStart'];
    else if (monthOf(f.to) > addMonths(monthOf(f.from), MAX_RANGE_MONTHS - 1)) errors.to = ['rangeTooLong'];
  }
  if (f.employmentType && !(EMPLOYMENT_TYPES as readonly string[]).includes(f.employmentType)) errors.employmentType = ['invalid'];
  if (f.employeeStatus && !(EMPLOYEE_STATUSES as readonly string[]).includes(f.employeeStatus)) errors.employeeStatus = ['invalid'];
  return errors;
}

/** Only the filters a report uses (the others are reset, so they never change its result or its cache key). */
export function relevantFilters(f: ReportFilters, fields: readonly FilterField[]): ReportFilters {
  const base = defaultFilters();
  return {
    from: fields.includes('dateRange') ? f.from : base.from,
    to: fields.includes('dateRange') ? f.to : base.to,
    departmentId: fields.includes('departmentId') ? f.departmentId : '',
    locationId: fields.includes('locationId') ? f.locationId : '',
    employmentType: fields.includes('employmentType') ? f.employmentType : '',
    employeeStatus: fields.includes('employeeStatus') ? f.employeeStatus : '',
  };
}

/** The applied filters, for display and the result (`Partial`: only those the report uses). */
export function appliedFilters(f: ReportFilters, fields: readonly FilterField[]): Partial<ReportFilters> {
  const out: Partial<ReportFilters> = {};
  if (fields.includes('dateRange')) Object.assign(out, { from: f.from, to: f.to });
  for (const key of ['departmentId', 'locationId', 'employmentType', 'employeeStatus'] as const) if (fields.includes(key) && f[key]) Object.assign(out, { [key]: f[key] });
  return out;
}

/** Filters → URL search params and back (saved reports and links open a report with its filters). */
export function filtersToParams(f: ReportFilters): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(f)) if (v) out[k] = v;
  return out;
}
export function filtersFromParams(params: URLSearchParams, base = defaultFilters()): ReportFilters {
  const get = (k: keyof ReportFilters) => params.get(k) ?? base[k];
  return {
    from: get('from'),
    to: get('to'),
    departmentId: get('departmentId'),
    locationId: get('locationId'),
    employmentType: (EMPLOYMENT_TYPES as readonly string[]).includes(get('employmentType')) ? (get('employmentType') as ReportFilters['employmentType']) : '',
    employeeStatus: (EMPLOYEE_STATUSES as readonly string[]).includes(get('employeeStatus')) ? (get('employeeStatus') as ReportFilters['employeeStatus']) : '',
  };
}
