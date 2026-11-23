import { hasPermission, type Permission, type Role } from '@/core/config/permissions';
import type { BuilderDataset, ReportCategory, ReportTab, ReportsCaller } from '@/modules/reports/types/reports';

/*
 * Who may see which reports — derived from the EXISTING permission matrix only (the real backend must apply the same
 * rules from the token). Reports never widen a module's own scope: a team-scoped reader gets team figures, and a
 * report category needs the source module's read permission as well as a reports permission.
 *
 * - `hr.reports.view`       → organisation-wide reports (System Admin, HR Admin, HR Manager);
 * - `hr.reports.view.team`  → the departments the user manages (Department Manager): employees, attendance, leave,
 *                          recruitment (read-only, no offers/salaries), performance and documents — never payroll;
 * - `hr.payroll.view`       → payroll reports (Payroll Officer, HR roles); `recruitment.jobs.view` → recruitment reports
 *                          (Recruiter, HR roles). Insights and the executive dashboard need `hr.reports.view`.
 * Employees (self-service only) have no reports: their own data is in each module's "My …" page.
 */

export type ModuleScope = 'organization' | 'team' | null;

export interface ReportAccess {
  caller: ReportsCaller;
  /** Organisation-wide reporting. */
  organization: boolean;
  /** Team reporting only (no organisation-wide figures). */
  team: boolean;
  scopes: Record<Exclude<ReportCategory, 'payroll'>, ModuleScope> & { payroll: 'organization' | null };
  /** Personal details (demographics) — `hr.employees.view.personal`. */
  personal: boolean;
  /** Individual performance ratings (not just aggregates). */
  individualRatings: boolean;
  /** Offers and salaries in recruitment (team readers never see them). */
  offers: boolean;
  categories: ReadonlySet<ReportCategory>;
  tabs: ReadonlySet<ReportTab>;
}

const can = (role: Role, p: Permission) => hasPermission(role, p);

/** Organisation scope when the role reads the whole module AND reports organisation-wide; team when it reads the team. */
function scopeOf(role: Role, organization: boolean, team: boolean, orgPermission: Permission, teamPermission: Permission | null): ModuleScope {
  if (organization && can(role, orgPermission)) return 'organization';
  if ((organization || team) && teamPermission && can(role, teamPermission)) return 'team';
  return null;
}

export function reportAccess(caller: ReportsCaller): ReportAccess {
  const { role } = caller;
  const organization = can(role, 'hr.reports.view');
  const team = !organization && can(role, 'hr.reports.view.team');
  const recruitment: ModuleScope = can(role, 'recruitment.jobs.view') ? 'organization' : team && can(role, 'hr.recruitment.view.team') ? 'team' : null;
  const scopes: ReportAccess['scopes'] = {
    employees: scopeOf(role, organization, team, 'organization.employees.view', 'hr.employees.view.team'),
    attendance: scopeOf(role, organization, team, 'hr.attendance.view', 'hr.attendance.view.team'),
    leave: scopeOf(role, organization, team, 'hr.leave.view', 'hr.leave.view.team'),
    recruitment,
    performance: scopeOf(role, organization, team, 'hr.performance.view', 'hr.performance.view.team'),
    payroll: can(role, 'hr.payroll.view') ? 'organization' : null,
    documents: scopeOf(role, organization, team, 'hr.documents.view', 'hr.documents.view.team'),
  };
  const categories = new Set<ReportCategory>((Object.keys(scopes) as ReportCategory[]).filter((c) => scopes[c] !== null));
  const tabs = new Set<ReportTab>();
  if (organization || team) tabs.add('overview');
  for (const c of categories) tabs.add(c);
  if (organization) {
    tabs.add('insights');
    tabs.add('executive');
  }
  if (categories.size > 0) {
    tabs.add('builder');
    tabs.add('saved');
  }
  return {
    caller,
    organization,
    team,
    scopes,
    personal: can(role, 'hr.employees.view.personal'),
    individualRatings: scopes.performance !== null,
    offers: recruitment === 'organization',
    categories,
    tabs,
  };
}

/** The category a report or builder dataset belongs to (`employees.directory` → `employees`). */
export const categoryOf = (id: string) => id.split('.')[0] as ReportCategory | 'insights' | 'executive';

export function canUseDataset(access: ReportAccess, dataset: BuilderDataset): boolean {
  return access.categories.has(categoryOf(dataset) as ReportCategory);
}
