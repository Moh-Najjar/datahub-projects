import type { Localized } from '@datahub/shared-types';
import { queryCollection } from '@/core/api/mock/collection';
import { ApiError, type ListParams, type Paginated } from '@/core/api/types';
import { hasPermission } from '@/core/config/permissions';
import { employeeRecords } from '@/modules/employees/mock/employeesMock';
import { orgTables } from '@/modules/organization/mock/organizationMock';
import {
  validateCompetencyInput,
  validateCycleInput,
  validateGoalInput,
  validateManagerReview,
  validatePlanInput,
  validateProgressInput,
  validateSelfAssessment,
  validateTemplateInput,
  type FieldErrors,
} from '@/modules/performance/schemas/performanceSchemas';
import type {
  AssessmentStatus,
  Competency,
  CompetencyFilters,
  CompetencyInput,
  CompetencyRating,
  CycleFilters,
  CycleInput,
  CycleStatus,
  DevelopmentPlan,
  EmployeeOption,
  EmployeePerformanceHistory,
  EmployeeRef,
  Goal,
  GoalCategory,
  GoalEvent,
  GoalFilters,
  GoalInput,
  GoalProgressInput,
  GoalRating,
  GoalStatus,
  ManagerReview,
  ManagerReviewInput,
  NamedRef,
  PerformanceScope,
  PerformanceSummary,
  PlanActivity,
  PlanFilters,
  PlanInput,
  PlanStatus,
  Priority,
  RatingLevel,
  RecordStatus,
  Review,
  ReviewCycle,
  ReviewFilters,
  ReviewState,
  ReviewSummary,
  ReviewTemplate,
  SelfAssessment,
  SelfAssessmentInput,
  TemplateInput,
} from '@/modules/performance/types/performance';
import { addDays, average, CURRENT_CYCLE_STATUSES, CYCLE_TRANSITIONS, FINAL_GOAL_STATUSES, OPEN_CYCLE_STATUSES, overlaps, todayIso } from '@/modules/performance/utils/rules';
import { ACTIVITY_POOL, COMPETENCY_SEED, DEFAULT_SCALE, GOAL_POOL, OBJECTIVE_POOL, TEMPLATE_SEED } from './seed';

/*
 * SIMULATED performance backend (in memory, reset on reload) — part of the same simulated backend as the employees and
 * organization mocks (participants, goal owners and plans reference EXISTING employee ids; departments are Organization
 * ids). Rules the real backend must enforce:
 *
 * - Scope: `organization` (performance:read), `team` (performance:read:team — departments the user manages, plus their
 *   own records) or `own` (performance:read:own). Outside it → `FORBIDDEN`; lists are filtered.
 * - Configuration (cycles, templates, competencies, rating scale) needs `performance:manage-config`.
 * - Self-assessments: only by the employee, in an open cycle, final once submitted (until HR reopens it). A manager sees
 *   a self-assessment only once submitted; the employee sees the manager review only once submitted.
 * - Manager reviews: `performance:write` (organization) or `performance:review:team` (team), never one's own, after the
 *   self-assessment (or its deadline); ratings must exist on the configured scale.
 * - Cycles: valid dates, no overlapping review periods; draft → active → (in progress → completed: automatic) → closed.
 */

type Employee = ReturnType<typeof employeeRecords.all>[number];

interface CycleRow {
  id: string;
  name: Localized<string>;
  description: string;
  startDate: string;
  endDate: string;
  periodStart: string;
  periodEnd: string;
  selfAssessmentDeadline: string;
  managerReviewDeadline: string;
  templateId: string;
  status: CycleStatus;
  createdAt: string;
  history: ReviewCycle['history'];
  participantIds: string[];
}

interface ReviewRow {
  id: string;
  cycleId: string;
  employeeId: string;
  reviewerId: string | null;
  competencyIds: string[];
  self: SelfAssessment;
  manager: Omit<ManagerReview, 'reviewer'> & { reviewerName: Localized<string> | null };
}

interface GoalRow {
  id: string;
  title: string;
  description: string;
  category: GoalCategory;
  employeeId: string | null;
  departmentId: string;
  cycleId: string | null;
  startDate: string;
  dueDate: string;
  target: string;
  progress: number;
  priority: Priority;
  status: GoalStatus;
  createdAt: string;
  history: GoalEvent[];
}

interface PlanRow {
  id: string;
  employeeId: string;
  title: string;
  objectives: string[];
  activities: PlanActivity[];
  targetDate: string;
  status: PlanStatus;
  cycleId: string | null;
  createdAt: string;
  updatedAt: string;
}

interface CompetencyRow {
  id: string;
  code: string;
  name: Localized<string>;
  description: string;
  criteria: string;
  status: RecordStatus;
  createdAt: string;
}

interface TemplateRow {
  id: string;
  name: Localized<string>;
  competencyIds: string[];
  status: RecordStatus;
  createdAt: string;
}

interface Db {
  scale: RatingLevel[];
  competencies: CompetencyRow[];
  templates: TemplateRow[];
  cycles: CycleRow[];
  reviews: ReviewRow[];
  goals: GoalRow[];
  plans: PlanRow[];
  seq: { cycle: number; review: number; goal: number; plan: number; competency: number; template: number; activity: number };
}

let db: Db | null = null;

/** Restore the initial state (tests). Data is regenerated on next use, relative to the current date. */
export function resetPerformanceMock(): void {
  db = null;
}

/* Helpers ------------------------------------------------------------------------------------------------- */

const SYSTEM: Localized<string> = { en: 'System', ar: 'النظام' };
const nowIso = () => new Date().toISOString();
const pad = (n: number, w: number) => String(n).padStart(w, '0');

function invalid(errors: FieldErrors): never {
  throw new ApiError('VALIDATION', 'Validation failed', errors);
}
function forbidden(message = 'Outside your performance scope'): never {
  throw new ApiError('FORBIDDEN', message);
}
function conflict(message: string): never {
  throw new ApiError('CONFLICT', message);
}
function notFound(what: string, id: string): never {
  throw new ApiError('NOT_FOUND', `${what} ${id} not found`);
}

function prng(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

const department = (id: string) => orgTables.departments().find((d) => d.id === id);
const position = (id: string) => orgTables.positions().find((p) => p.id === id);
const deptRef = (id: string): NamedRef => ({ id, name: department(id)?.name ?? { en: id, ar: id } });
const posRef = (id: string): NamedRef => ({ id, name: position(id)?.title ?? { en: id, ar: id } });
const empRow = (id: string): Employee | undefined => employeeRecords.get(id);
function employeeRef(id: string): EmployeeRef {
  const e = empRow(id);
  return e ? { id, name: employeeRecords.fullName(e), employeeNumber: e.employeeNumber, department: deptRef(e.departmentId) } : { id, name: { en: id, ar: id }, employeeNumber: '', department: { id: '', name: { en: '', ar: '' } } };
}
const personRef = (id: string | null): NamedRef | null => {
  const e = id ? empRow(id) : undefined;
  return e ? { id: e.id, name: employeeRecords.fullName(e) } : null;
};

function topLevel(departmentId: string): string {
  let current = department(departmentId);
  const seen = new Set<string>();
  while (current?.parentId && !seen.has(current.id)) {
    seen.add(current.id);
    current = department(current.parentId);
  }
  return current?.id ?? departmentId;
}

/** The employee's reviewer: their manager, else the nearest department manager (never themselves). */
function reviewerOf(e: Employee): string | null {
  if (e.managerId && e.managerId !== e.id && empRow(e.managerId)?.status === 'active') return e.managerId;
  let current = department(e.departmentId);
  const seen = new Set<string>();
  while (current && !seen.has(current.id)) {
    seen.add(current.id);
    if (current.managerId && current.managerId !== e.id && empRow(current.managerId)?.status === 'active') return current.managerId;
    current = current.parentId ? department(current.parentId) : undefined;
  }
  return e.id === 'emp-0003' ? null : 'emp-0003';
}

const meOf = (scope: PerformanceScope) => employeeRecords.employeeIdOf(scope.userId) ?? null;
function actor(scope: PerformanceScope): Localized<string> {
  const id = meOf(scope);
  const e = id ? empRow(id) : undefined;
  return e ? employeeRecords.fullName(e) : { en: scope.userId, ar: scope.userId };
}

const emptySelf = (goalIds: string[]): SelfAssessment => ({ status: 'not-started', goalRatings: goalIds.map((goalId) => ({ goalId, rating: null, comment: '' })), achievements: '', challenges: '', comments: '', submittedAt: null });
const emptyManager = (goalIds: string[], competencyIds: string[]): ReviewRow['manager'] => ({
  status: 'not-started',
  goalRatings: goalIds.map((goalId) => ({ goalId, rating: null, comment: '' })),
  competencyRatings: competencyIds.map((competencyId) => ({ competencyId, rating: null, comment: '' })),
  strengths: '',
  improvements: '',
  development: '',
  comments: '',
  overallRating: null,
  submittedAt: null,
  reviewerName: null,
});

/* Seed generation ----------------------------------------------------------------------------------------- */

function generate(): Db {
  const today = todayIso();
  const Y = Number(today.slice(0, 4));
  const r = prng(hashString('performance-seed-v1'));
  const pick = <T,>(list: readonly T[]): T => list[Math.floor(r() * list.length)]!;
  const created = '2023-01-10T09:00:00.000Z';
  const d: Db = {
    scale: DEFAULT_SCALE.map((l) => ({ ...l })),
    competencies: COMPETENCY_SEED.map((c) => ({ ...c, status: 'active', createdAt: created })),
    templates: TEMPLATE_SEED.map((t) => ({ ...t, competencyIds: [...t.competencyIds], status: 'active', createdAt: created })),
    cycles: [],
    reviews: [],
    goals: [],
    plans: [],
    seq: { cycle: 0, review: 0, goal: 0, plan: 0, competency: COMPETENCY_SEED.length, template: TEMPLATE_SEED.length, activity: 0 },
  };
  const hr = employeeRecords.fullName(empRow('emp-0002')!);
  const employees = employeeRecords.all();
  /** Per-employee performance level (deterministic), ratings vary around it per cycle. */
  const level = new Map(employees.map((e) => [e.id, 2.4 + prng(hashString(`perf|${e.id}`))() * 2.1]));
  const ratingFor = (id: string) => Math.min(5, Math.max(1, Math.round(level.get(id)! + (r() - 0.5) * 1.4)));
  const at = (date: string, hour = 10) => {
    const [y, m, dd] = date.split('-').map(Number) as [number, number, number];
    return new Date(y, m - 1, dd, hour).toISOString();
  };

  const cycle = (name: Localized<string>, periodStart: string, periodEnd: string, startDate: string, endDate: string, selfDeadline: string, managerDeadline: string, status: CycleStatus): CycleRow => {
    d.seq.cycle++;
    const createdAt = at(addDays(startDate, -20), 9);
    const history: ReviewCycle['history'] = [{ at: createdAt, by: hr, from: null, to: 'draft', note: '' }];
    const flow: CycleStatus[] = status === 'draft' ? [] : status === 'active' ? ['active'] : status === 'in-progress' ? ['active', 'in-progress'] : status === 'completed' ? ['active', 'in-progress', 'completed'] : ['active', 'in-progress', 'completed', 'closed'];
    const when: Record<CycleStatus, string> = { draft: startDate, active: startDate, 'in-progress': addDays(startDate, 3), completed: addDays(managerDeadline, -1), closed: addDays(endDate, 1) };
    let prev: CycleStatus = 'draft';
    for (const to of flow) {
      const day = when[to] > today ? today : when[to];
      history.push({ at: at(day, 11), by: to === 'in-progress' || to === 'completed' ? SYSTEM : hr, from: prev, to, note: '' });
      prev = to;
    }
    const row: CycleRow = { id: `cyc-${pad(d.seq.cycle, 3)}`, name, description: 'Example review cycle for the demo.', startDate, endDate, periodStart, periodEnd, selfAssessmentDeadline: selfDeadline, managerReviewDeadline: managerDeadline, templateId: 'tpl-01', status, createdAt, history, participantIds: [] };
    d.cycles.push(row);
    return row;
  };
  const yr = (n: number) => String(n);
  const cycles = [
    cycle({ en: `Annual Review ${Y - 2}`, ar: `المراجعة السنوية ${Y - 2}` }, `${Y - 2}-01-01`, `${Y - 2}-12-31`, `${Y - 1}-01-05`, `${Y - 1}-02-20`, `${Y - 1}-01-25`, `${Y - 1}-02-15`, 'closed'),
    cycle({ en: `Annual Review ${Y - 1}`, ar: `المراجعة السنوية ${Y - 1}` }, `${Y - 1}-01-01`, `${Y - 1}-12-31`, `${yr(Y)}-01-05`, `${yr(Y)}-02-20`, `${yr(Y)}-01-25`, `${yr(Y)}-02-15`, 'closed'),
    cycle({ en: `Mid-Year Review ${Y}`, ar: `مراجعة منتصف العام ${Y}` }, `${Y}-01-01`, `${Y}-06-30`, `${Y}-07-01`, `${Y}-08-15`, `${Y}-07-20`, `${Y}-08-10`, 'completed'),
    cycle({ en: `Year-End Review ${Y}`, ar: `مراجعة نهاية العام ${Y}` }, `${Y}-07-01`, `${Y}-12-31`, addDays(today, -10), addDays(today, 45), addDays(today, 10), addDays(today, 30), 'in-progress'),
    cycle({ en: `Annual Review ${Y + 1}`, ar: `المراجعة السنوية ${Y + 1}` }, `${Y + 1}-01-01`, `${Y + 1}-12-31`, `${Y + 2}-01-05`, `${Y + 2}-02-20`, `${Y + 2}-01-25`, `${Y + 2}-02-15`, 'draft'),
  ];
  const leaders = new Set(orgTables.departments().map((x) => x.managerId).filter(Boolean));

  for (const c of cycles) {
    if (c.status === 'draft') continue;
    const participants = employees.filter((e) => {
      if (e.hireDate > c.periodEnd) return false;
      if (e.status === 'active') return true;
      const since = employeeRecords.inactiveSince(e.id);
      return since !== null && since > c.startDate;
    });
    c.participantIds = participants.map((e) => e.id);
    const current = c.status === 'in-progress';
    for (const e of participants) {
      const template = d.templates.find((t) => t.id === (leaders.has(e.id) ? 'tpl-02' : 'tpl-01'))!;
      // Goals of the cycle (2 per participant for the two recent cycles).
      const goalIds: string[] = [];
      if (c.periodStart >= `${Y}-01-01`) {
        for (let i = 0; i < 2; i++) {
          d.seq.goal++;
          const category = pick(['business', 'business', 'technical', 'technical', 'leadership', 'personal-development'] as const);
          const [title, target] = pick(GOAL_POOL[category]);
          const progress = current ? Math.round(r() * 9) * 10 : 100;
          const status: GoalStatus = !current ? (r() < 0.85 ? 'completed' : 'cancelled') : progress === 0 ? 'not-started' : r() < 0.15 ? 'at-risk' : 'in-progress';
          const goal: GoalRow = {
            id: `gol-${pad(d.seq.goal, 4)}`,
            title,
            description: '',
            category,
            employeeId: e.id,
            departmentId: e.departmentId,
            cycleId: c.id,
            startDate: c.periodStart,
            dueDate: c.periodEnd,
            target,
            progress: status === 'cancelled' ? Math.round(r() * 5) * 10 : progress,
            priority: pick(['low', 'medium', 'medium', 'high'] as const),
            status,
            createdAt: at(c.periodStart, 9),
            history: [{ at: at(c.periodStart, 9), by: personRef(reviewerOf(e))?.name ?? hr, type: 'created', from: null, to: null, note: '' }],
          };
          if (status !== 'not-started') goal.history.push({ at: at(current ? addDays(today, -5) : c.periodEnd, 15), by: employeeRecords.fullName(e), type: 'progress', from: '0', to: String(goal.progress), note: '' });
          d.goals.push(goal);
          goalIds.push(goal.id);
        }
      }
      d.seq.review++;
      const review: ReviewRow = { id: `rev-${pad(d.seq.review, 4)}`, cycleId: c.id, employeeId: e.id, reviewerId: reviewerOf(e), competencyIds: [...template.competencyIds], self: emptySelf(goalIds), manager: emptyManager(goalIds, template.competencyIds) };
      const overall = ratingFor(e.id);
      const fillSelf = (status: AssessmentStatus) => {
        review.self = {
          status,
          goalRatings: goalIds.map((goalId) => ({ goalId, rating: Math.min(5, Math.max(1, overall + (r() < 0.3 ? 1 : 0))), comment: '' })),
          achievements: 'Delivered the agreed objectives for the period.',
          challenges: status === 'submitted' ? 'Competing priorities during peak months.' : '',
          comments: '',
          submittedAt: status === 'submitted' ? at(addDays(c.selfAssessmentDeadline, -Math.floor(r() * 6)), 14) : null,
        };
      };
      const fillManager = (status: AssessmentStatus) => {
        review.manager = {
          status,
          goalRatings: goalIds.map((goalId) => ({ goalId, rating: overall, comment: '' })),
          competencyRatings: review.competencyIds.map((competencyId) => ({ competencyId, rating: Math.min(5, Math.max(1, overall + Math.round((r() - 0.5) * 1.2))), comment: '' })),
          strengths: 'Reliable delivery and good collaboration.',
          improvements: 'Plan ahead for peak periods.',
          development: 'Take on a stretch assignment next period.',
          comments: '',
          overallRating: status === 'submitted' ? overall : null,
          submittedAt: status === 'submitted' ? at(addDays(c.managerReviewDeadline, -Math.floor(r() * 6)), 16) : null,
          reviewerName: personRef(review.reviewerId)?.name ?? hr,
        };
      };
      if (!current) {
        fillSelf('submitted');
        fillManager('submitted');
      } else if (e.id !== 'emp-0025') {
        // The demo employee (Sami, emp-0025) keeps a not-started self-assessment to try the flow.
        const roll = r();
        if (roll < 0.55) {
          fillSelf('submitted');
          const m = r();
          if (m < 0.45) fillManager('submitted');
          else if (m < 0.6) fillManager('draft');
        } else if (roll < 0.75) fillSelf('draft');
      }
      d.reviews.push(review);
    }
  }

  // Department goals (one per top-level department) in the current cycle.
  const currentCycle = cycles[3]!;
  for (const dep of orgTables.departments().filter((x) => !x.parentId && x.status === 'active')) {
    d.seq.goal++;
    const [title, target] = pick(GOAL_POOL.business);
    d.goals.push({ id: `gol-${pad(d.seq.goal, 4)}`, title, description: 'Department objective.', category: 'business', employeeId: null, departmentId: dep.id, cycleId: currentCycle.id, startDate: currentCycle.periodStart, dueDate: currentCycle.periodEnd, target, progress: Math.round(r() * 8) * 10, priority: 'high', status: 'in-progress', createdAt: at(currentCycle.periodStart, 9), history: [{ at: at(currentCycle.periodStart, 9), by: hr, type: 'created', from: null, to: null, note: '' }] });
  }

  // Development plans for about a quarter of active employees.
  for (const e of employees.filter((x) => x.status === 'active')) {
    if (r() > 0.25 && e.id !== 'emp-0025') continue;
    d.seq.plan++;
    // Distinct activities per plan.
    const pool = ACTIVITY_POOL.map((x) => ({ x, k: r() })).sort((a1, b1) => a1.k - b1.k).map((y) => y.x);
    const activities: PlanActivity[] = Array.from({ length: 2 + Math.floor(r() * 2) }, (_, i) => {
      d.seq.activity++;
      const [type, title] = pool[i]!;
      const status = pick(['planned', 'in-progress', 'done'] as const);
      // The demo employee (emp-0025) always has an open activity to update.
      return { id: `act-${pad(d.seq.activity, 4)}`, type, title, targetDate: addDays(today, 30 + i * 45), status: e.id === 'emp-0025' && i === 0 ? 'in-progress' : status };
    });
    d.plans.push({ id: `pln-${pad(d.seq.plan, 3)}`, employeeId: e.id, title: `Development plan ${Y}`, objectives: [pick(OBJECTIVE_POOL), pick(OBJECTIVE_POOL)].filter((v, i, a) => a.indexOf(v) === i), activities, targetDate: addDays(today, 180), status: e.id === 'emp-0025' || r() < 0.85 ? 'active' : 'draft', cycleId: currentCycle.id, createdAt: at(addDays(today, -40), 9), updatedAt: at(addDays(today, -5), 9) });
  }
  return d;
}

function data(): Db {
  if (!db) db = generate();
  return db;
}

/* Scope ---------------------------------------------------------------------------------------------------- */

interface Access {
  role: PerformanceScope['role'];
  kind: PerformanceScope['kind'];
  me: string | null;
  units: Set<string>;
  /** Organization-wide performance management (HR). */
  write: boolean;
  /** Team reviewer (Department Manager). */
  teamReview: boolean;
  config: boolean;
}

function access(scope: PerformanceScope): Access {
  const me = meOf(scope);
  const base = { role: scope.role, kind: scope.kind, me, config: hasPermission(scope.role, 'performance:manage-config') };
  if (scope.kind === 'organization') {
    if (!hasPermission(scope.role, 'performance:read')) forbidden();
    return { ...base, units: new Set(), write: hasPermission(scope.role, 'performance:write'), teamReview: false };
  }
  if (scope.kind === 'team') {
    if (!hasPermission(scope.role, 'performance:read:team')) forbidden();
    return { ...base, units: employeeRecords.teamUnits(scope.userId), write: false, teamReview: hasPermission(scope.role, 'performance:review:team') };
  }
  if (!hasPermission(scope.role, 'performance:read:own')) forbidden();
  return { ...base, units: new Set(), write: false, teamReview: false, config: false };
}

/** May the caller see this employee's performance records? */
function visibleEmployee(a: Access, employeeId: string): boolean {
  if (a.kind === 'organization') return true;
  if (employeeId === a.me) return true;
  const e = empRow(employeeId);
  return a.kind === 'team' && Boolean(e && a.units.has(e.departmentId));
}
const visibleDepartment = (a: Access, departmentId: string) => a.kind === 'organization' || (a.kind === 'team' && a.units.has(departmentId)) || (a.me !== null && empRow(a.me)?.departmentId === departmentId);

/** May the caller manage (write goals, plans, manager reviews for) this employee? Never themselves. */
function manages(a: Access, employeeId: string): boolean {
  if (employeeId === a.me) return false;
  if (a.write) return true;
  const e = empRow(employeeId);
  return a.teamReview && Boolean(e && a.units.has(e.departmentId));
}
const managesDepartment = (a: Access, departmentId: string) => a.write || (a.teamReview && a.units.has(departmentId));

function requireConfig(a: Access) {
  if (!a.config) forbidden('performance:manage-config is required');
}

const begin = (scope: PerformanceScope) => ({ d: data(), a: access(scope) });

/* Rating scale, competencies, templates ---------------------------------------------------------------------- */

export function ratingScale(scope: PerformanceScope): RatingLevel[] {
  return begin(scope).d.scale;
}

/** Labels and descriptions of the scale values are configurable (the 1–5 values themselves are fixed). */
export function updateRatingScale(levels: RatingLevel[], scope: PerformanceScope): RatingLevel[] {
  const { d, a } = begin(scope);
  requireConfig(a);
  const errors: FieldErrors = {};
  if (levels.length !== d.scale.length || levels.some((l, i) => l.value !== d.scale[i]!.value)) errors.form = ['scaleValuesFixed'];
  levels.forEach((l, i) => {
    if (!l.label.en.trim() || !l.label.ar.trim()) errors[`levels.${i}.label`] = ['required'];
  });
  if (Object.keys(errors).length) invalid(errors);
  d.scale = levels.map((l) => ({ value: l.value, label: { en: l.label.en.trim(), ar: l.label.ar.trim() }, description: { en: l.description.en.trim(), ar: l.description.ar.trim() } }));
  return d.scale;
}

const templateUsedByOpenCycle = (d: Db, templateId: string) => d.cycles.some((c) => c.templateId === templateId && OPEN_CYCLE_STATUSES.includes(c.status));

function toCompetency(d: Db, c: CompetencyRow): Competency {
  return { ...c, templateCount: d.templates.filter((t) => t.competencyIds.includes(c.id)).length };
}

export function listCompetencies(params: ListParams<CompetencyFilters>, scope: PerformanceScope): Paginated<Competency> {
  const { d } = begin(scope);
  const rows = d.competencies.map((c) => ({ ...toCompetency(d, c), 'name.en': c.name.en, 'name.ar': c.name.ar }));
  const page = queryCollection(rows, params, { searchFields: ['code', 'name.en', 'name.ar'] });
  return { ...page, items: page.items.map(({ 'name.en': _e, 'name.ar': _a, ...c }) => c) };
}

function checkCompetency(d: Db, input: CompetencyInput, exceptId?: string): CompetencyInput {
  const errors = validateCompetencyInput(input);
  if (errors) invalid(errors);
  const code = input.code.trim().toUpperCase();
  if (d.competencies.some((c) => c.id !== exceptId && c.code === code)) invalid({ code: ['duplicateCode'] });
  return { code, name: { en: input.name.en.trim(), ar: input.name.ar.trim() }, description: input.description.trim(), criteria: input.criteria.trim() };
}

export function createCompetency(input: CompetencyInput, scope: PerformanceScope): Competency {
  const { d, a } = begin(scope);
  requireConfig(a);
  const v = checkCompetency(d, input);
  d.seq.competency++;
  const row: CompetencyRow = { ...v, id: `cmp-${pad(d.seq.competency, 2)}`, status: 'active', createdAt: nowIso() };
  d.competencies.push(row);
  return toCompetency(d, row);
}

export function updateCompetency(id: string, input: CompetencyInput, scope: PerformanceScope): Competency {
  const { d, a } = begin(scope);
  requireConfig(a);
  const row = d.competencies.find((c) => c.id === id) ?? notFound('Competency', id);
  Object.assign(row, checkCompetency(d, input, id));
  return toCompetency(d, row);
}

export function updateCompetencyStatus(id: string, status: RecordStatus, scope: PerformanceScope): Competency {
  const { d, a } = begin(scope);
  requireConfig(a);
  const row = d.competencies.find((c) => c.id === id) ?? notFound('Competency', id);
  if (row.status === status) conflict(`Competency ${row.code} is already ${status}`);
  if (status === 'inactive' && d.templates.some((t) => t.competencyIds.includes(id) && templateUsedByOpenCycle(d, t.id))) invalid({ status: ['competencyInUse'] });
  row.status = status;
  return toCompetency(d, row);
}

function toTemplate(d: Db, t: TemplateRow): ReviewTemplate {
  return { id: t.id, name: t.name, status: t.status, createdAt: t.createdAt, competencies: t.competencyIds.map((cid) => ({ id: cid, name: d.competencies.find((c) => c.id === cid)?.name ?? { en: cid, ar: cid } })) };
}

export function listTemplates(scope: PerformanceScope): ReviewTemplate[] {
  const { d } = begin(scope);
  return d.templates.map((t) => toTemplate(d, t));
}

function checkTemplate(d: Db, input: TemplateInput) {
  const errors = validateTemplateInput(input);
  if (errors) invalid(errors);
  if (input.competencyIds.some((cid) => d.competencies.find((c) => c.id === cid)?.status !== 'active')) invalid({ competencyIds: ['inactiveCompetency'] });
}

export function createTemplate(input: TemplateInput, scope: PerformanceScope): ReviewTemplate {
  const { d, a } = begin(scope);
  requireConfig(a);
  checkTemplate(d, input);
  d.seq.template++;
  const row: TemplateRow = { id: `tpl-${pad(d.seq.template, 2)}`, name: { en: input.name.en.trim(), ar: input.name.ar.trim() }, competencyIds: [...new Set(input.competencyIds)], status: 'active', createdAt: nowIso() };
  d.templates.push(row);
  return toTemplate(d, row);
}

/** Templates used by an open cycle are locked (its reviews were created from them). */
export function updateTemplate(id: string, input: TemplateInput, scope: PerformanceScope): ReviewTemplate {
  const { d, a } = begin(scope);
  requireConfig(a);
  const row = d.templates.find((t) => t.id === id) ?? notFound('Template', id);
  if (templateUsedByOpenCycle(d, id)) invalid({ form: ['templateInUse'] });
  checkTemplate(d, input);
  Object.assign(row, { name: { en: input.name.en.trim(), ar: input.name.ar.trim() }, competencyIds: [...new Set(input.competencyIds)] });
  return toTemplate(d, row);
}

/* Cycles ------------------------------------------------------------------------------------------------------ */

const reviewState = (r: ReviewRow): ReviewState => (r.manager.status === 'submitted' ? 'completed' : r.self.status === 'submitted' ? 'pending-manager' : 'pending-self');

function cycleVisible(a: Access, c: CycleRow): boolean {
  if (a.kind === 'organization') return true;
  if (c.status === 'draft') return false;
  return c.participantIds.some((id) => visibleEmployee(a, id));
}

function toCycle(d: Db, a: Access, c: CycleRow): ReviewCycle {
  const reviews = d.reviews.filter((r) => r.cycleId === c.id && visibleEmployee(a, r.employeeId));
  return {
    id: c.id,
    name: c.name,
    description: c.description,
    startDate: c.startDate,
    endDate: c.endDate,
    periodStart: c.periodStart,
    periodEnd: c.periodEnd,
    selfAssessmentDeadline: c.selfAssessmentDeadline,
    managerReviewDeadline: c.managerReviewDeadline,
    template: { id: c.templateId, name: d.templates.find((t) => t.id === c.templateId)?.name ?? { en: c.templateId, ar: c.templateId } },
    status: c.status,
    createdAt: c.createdAt,
    history: c.history,
    participants: a.kind === 'organization' ? c.participantIds.length : c.participantIds.filter((id) => visibleEmployee(a, id)).length,
    progress: { total: reviews.length, selfSubmitted: reviews.filter((r) => r.self.status === 'submitted').length, managerSubmitted: reviews.filter((r) => r.manager.status === 'submitted').length },
    nextStatuses: a.config ? [...CYCLE_TRANSITIONS[c.status]] : [],
    can: { edit: a.config && c.status === 'draft', assign: a.config && (c.status === 'draft' || OPEN_CYCLE_STATUSES.includes(c.status)) },
  };
}

export function listCycles(params: ListParams<CycleFilters>, scope: PerformanceScope): Paginated<ReviewCycle> {
  const { d, a } = begin(scope);
  const rows = d.cycles
    .filter((c) => cycleVisible(a, c) && (!params.filters?.status || c.status === params.filters.status))
    .sort((x, y) => y.startDate.localeCompare(x.startDate))
    .map((c) => ({ ...toCycle(d, a, c), 'name.en': c.name.en, 'name.ar': c.name.ar }));
  const page = queryCollection(rows, { ...params, filters: {} }, { searchFields: ['name.en', 'name.ar'] });
  return { ...page, items: page.items.map(({ 'name.en': _e, 'name.ar': _a, ...c }) => c) };
}

function visibleCycle(a: Access, d: Db, id: string): CycleRow {
  const c = d.cycles.find((x) => x.id === id) ?? notFound('Cycle', id);
  if (!cycleVisible(a, c)) forbidden();
  return c;
}

export function getCycle(id: string, scope: PerformanceScope): ReviewCycle {
  const { d, a } = begin(scope);
  return toCycle(d, a, visibleCycle(a, d, id));
}

function checkCycle(d: Db, input: CycleInput, exceptId?: string): CycleInput {
  const errors = validateCycleInput(input);
  if (errors) invalid(errors);
  const template = d.templates.find((t) => t.id === input.templateId);
  if (!template || template.status !== 'active') invalid({ templateId: ['inactive'] });
  const clash = d.cycles.find((c) => c.id !== exceptId && overlaps({ start: c.periodStart, end: c.periodEnd }, { start: input.periodStart, end: input.periodEnd }));
  if (clash) invalid({ periodStart: ['periodOverlap'] });
  return { ...input, name: { en: input.name.en.trim(), ar: input.name.ar.trim() }, description: input.description.trim() };
}

export function createCycle(input: CycleInput, scope: PerformanceScope): ReviewCycle {
  const { d, a } = begin(scope);
  requireConfig(a);
  const v = checkCycle(d, input);
  d.seq.cycle++;
  const createdAt = nowIso();
  const row: CycleRow = { ...v, id: `cyc-${pad(d.seq.cycle, 3)}`, status: 'draft', createdAt, history: [{ at: createdAt, by: actor(scope), from: null, to: 'draft', note: '' }], participantIds: [] };
  d.cycles.push(row);
  return toCycle(d, a, row);
}

/** Only draft cycles are edited (active cycles keep their dates and template: reviews were created from them). */
export function updateCycle(id: string, input: CycleInput, scope: PerformanceScope): ReviewCycle {
  const { d, a } = begin(scope);
  requireConfig(a);
  const c = visibleCycle(a, d, id);
  if (c.status !== 'draft') conflict(`Cycle ${id} is ${c.status}; only drafts can be edited`);
  Object.assign(c, checkCycle(d, input, id));
  return toCycle(d, a, c);
}

function createReview(d: Db, c: CycleRow, employeeId: string) {
  const e = empRow(employeeId)!;
  const template = d.templates.find((t) => t.id === c.templateId)!;
  const goalIds = d.goals.filter((g) => g.cycleId === c.id && g.employeeId === employeeId && g.status !== 'cancelled').map((g) => g.id);
  d.seq.review++;
  d.reviews.push({ id: `rev-${pad(d.seq.review, 4)}`, cycleId: c.id, employeeId, reviewerId: reviewerOf(e), competencyIds: [...template.competencyIds], self: emptySelf(goalIds), manager: emptyManager(goalIds, template.competencyIds) });
}

/** Adds / removes participants. Removing is refused once the employee started their review. */
export function assignParticipants(id: string, change: { add: string[]; remove: string[] }, scope: PerformanceScope): ReviewCycle {
  const { d, a } = begin(scope);
  requireConfig(a);
  const c = visibleCycle(a, d, id);
  if (c.status !== 'draft' && !OPEN_CYCLE_STATUSES.includes(c.status)) conflict(`Cycle ${id} is ${c.status}`);
  const errors: FieldErrors = {};
  for (const eid of change.add) if (empRow(eid)?.status !== 'active') errors.add = ['inactiveEmployee'];
  for (const eid of change.remove) {
    const review = d.reviews.find((r) => r.cycleId === c.id && r.employeeId === eid);
    if (review && (review.self.status !== 'not-started' || review.manager.status !== 'not-started')) errors.remove = ['reviewStarted'];
  }
  if (Object.keys(errors).length) invalid(errors);
  for (const eid of change.add) {
    if (c.participantIds.includes(eid)) continue;
    c.participantIds.push(eid);
    if (c.status !== 'draft') createReview(d, c, eid);
  }
  c.participantIds = c.participantIds.filter((eid) => !change.remove.includes(eid));
  d.reviews = d.reviews.filter((r) => !(r.cycleId === c.id && change.remove.includes(r.employeeId)));
  return toCycle(d, a, c);
}

export function updateCycleStatus(id: string, status: CycleStatus, note: string, scope: PerformanceScope): ReviewCycle {
  const { d, a } = begin(scope);
  requireConfig(a);
  const c = visibleCycle(a, d, id);
  if (!CYCLE_TRANSITIONS[c.status].includes(status)) conflict(`Cycle ${id} cannot go from ${c.status} to ${status}`);
  if (status === 'active') {
    if (c.participantIds.length === 0) invalid({ status: ['noParticipants'] });
    if (d.templates.find((t) => t.id === c.templateId)?.status !== 'active') invalid({ status: ['templateInactive'] });
    for (const eid of c.participantIds) if (!d.reviews.some((r) => r.cycleId === c.id && r.employeeId === eid)) createReview(d, c, eid);
  }
  c.history.push({ at: nowIso(), by: actor(scope), from: c.status, to: status, note: note.trim() });
  c.status = status;
  return toCycle(d, a, c);
}

/** SYSTEM: first submission → in progress; every manager review submitted → completed (and back if one reopens). */
function syncCycleStatus(d: Db, c: CycleRow) {
  const reviews = d.reviews.filter((r) => r.cycleId === c.id);
  const move = (to: CycleStatus) => {
    c.history.push({ at: nowIso(), by: SYSTEM, from: c.status, to, note: '' });
    c.status = to;
  };
  if (c.status === 'active' && reviews.some((r) => r.self.status === 'submitted' || r.manager.status === 'submitted')) move('in-progress');
  if (c.status === 'in-progress' && reviews.length > 0 && reviews.every((r) => r.manager.status === 'submitted')) move('completed');
  else if (c.status === 'completed' && reviews.some((r) => r.manager.status !== 'submitted')) move('in-progress');
}

/* Goals ------------------------------------------------------------------------------------------------------- */

function toGoal(d: Db, a: Access, g: GoalRow): Goal {
  const owner = g.employeeId ? employeeRef(g.employeeId) : null;
  const cycle = g.cycleId ? d.cycles.find((c) => c.id === g.cycleId) : undefined;
  const final = FINAL_GOAL_STATUSES.includes(g.status);
  const manager = g.employeeId ? manages(a, g.employeeId) : managesDepartment(a, g.departmentId);
  return {
    id: g.id,
    title: g.title,
    description: g.description,
    category: g.category,
    owner,
    department: deptRef(g.departmentId),
    cycle: cycle ? { id: cycle.id, name: cycle.name } : null,
    startDate: g.startDate,
    dueDate: g.dueDate,
    target: g.target,
    progress: g.progress,
    priority: g.priority,
    status: g.status,
    createdAt: g.createdAt,
    history: g.history,
    can: { edit: manager && !final, progress: !final && (manager || (g.employeeId !== null && g.employeeId === a.me)) },
  };
}

const goalVisible = (a: Access, g: GoalRow) => (g.employeeId ? visibleEmployee(a, g.employeeId) : visibleDepartment(a, g.departmentId));

export function listGoals(params: ListParams<GoalFilters>, scope: PerformanceScope): Paginated<Goal> {
  const { d, a } = begin(scope);
  const f = params.filters ?? {};
  const units = f.departmentId ? new Set([f.departmentId, ...orgTables.descendants(f.departmentId)]) : null;
  const priorityOrder: Record<Priority, number> = { low: 0, medium: 1, high: 2 };
  const rows = d.goals
    .filter(
      (g) =>
        goalVisible(a, g) &&
        (!f.status || g.status === f.status) &&
        (!f.category || g.category === f.category) &&
        (!f.cycleId || g.cycleId === f.cycleId) &&
        (!units || units.has(g.departmentId)) &&
        (!f.employeeId || g.employeeId === f.employeeId) &&
        (!f.ownerType || (f.ownerType === 'employee' ? g.employeeId !== null : g.employeeId === null)),
    )
    .sort((x, y) => x.dueDate.localeCompare(y.dueDate) || x.id.localeCompare(y.id))
    .map((g) => {
      const view = toGoal(d, a, g);
      return { ...view, priorityOrder: priorityOrder[g.priority], search: `${g.title} ${view.owner?.name.en ?? ''} ${view.owner?.name.ar ?? ''} ${view.owner?.employeeNumber ?? ''}` };
    });
  const sortBy = params.sortBy === 'priority' ? 'priorityOrder' : params.sortBy;
  const page = queryCollection(rows, { ...params, sortBy, filters: {} }, { searchFields: ['search'] });
  return { ...page, items: page.items.map(({ search: _s, priorityOrder: _p, ...g }) => g) };
}

export function getGoal(id: string, scope: PerformanceScope): Goal {
  const { d, a } = begin(scope);
  const g = d.goals.find((x) => x.id === id) ?? notFound('Goal', id);
  if (!goalVisible(a, g)) forbidden();
  return toGoal(d, a, g);
}

function checkGoal(d: Db, a: Access, input: GoalInput) {
  const errors = validateGoalInput(input);
  if (errors) invalid(errors);
  const fieldErrors: FieldErrors = {};
  let departmentId = input.departmentId;
  if (input.ownerType === 'employee') {
    const e = input.employeeId ? empRow(input.employeeId) : undefined;
    if (!e || e.status !== 'active') fieldErrors.employeeId = ['inactiveEmployee'];
    else if (!manages(a, e.id)) forbidden('Outside your team');
    else departmentId = e.departmentId;
  } else {
    if (department(input.departmentId)?.status !== 'active') fieldErrors.departmentId = ['inactive'];
    else if (!managesDepartment(a, input.departmentId)) forbidden('Outside your team');
  }
  const cycle = input.cycleId ? d.cycles.find((c) => c.id === input.cycleId) : undefined;
  if (input.cycleId && (!cycle || cycle.status === 'closed' || cycle.status === 'completed')) fieldErrors.cycleId = ['cycleClosed'];
  if (Object.keys(fieldErrors).length) invalid(fieldErrors);
  return { ...input, departmentId, title: input.title.trim(), description: input.description.trim(), target: input.target.trim() };
}

/** Adds the goal to the owner's open review in that cycle (so it can be rated). */
function attachGoalToReview(d: Db, g: GoalRow) {
  const review = g.employeeId && g.cycleId ? d.reviews.find((r) => r.cycleId === g.cycleId && r.employeeId === g.employeeId) : undefined;
  if (!review || review.self.goalRatings.some((x) => x.goalId === g.id)) return;
  review.self.goalRatings.push({ goalId: g.id, rating: null, comment: '' });
  review.manager.goalRatings.push({ goalId: g.id, rating: null, comment: '' });
}

export function createGoal(input: GoalInput, scope: PerformanceScope): Goal {
  const { d, a } = begin(scope);
  const v = checkGoal(d, a, input);
  d.seq.goal++;
  const createdAt = nowIso();
  const row: GoalRow = { id: `gol-${pad(d.seq.goal, 4)}`, title: v.title, description: v.description, category: v.category, employeeId: v.ownerType === 'employee' ? v.employeeId : null, departmentId: v.departmentId, cycleId: v.cycleId, startDate: v.startDate, dueDate: v.dueDate, target: v.target, progress: 0, priority: v.priority, status: 'not-started', createdAt, history: [{ at: createdAt, by: actor(scope), type: 'created', from: null, to: null, note: '' }] };
  d.goals.push(row);
  attachGoalToReview(d, row);
  return toGoal(d, a, row);
}

export function updateGoal(id: string, input: GoalInput, scope: PerformanceScope): Goal {
  const { d, a } = begin(scope);
  const g = d.goals.find((x) => x.id === id) ?? notFound('Goal', id);
  if (!goalVisible(a, g)) forbidden();
  if (FINAL_GOAL_STATUSES.includes(g.status)) conflict(`Goal ${id} is ${g.status}`);
  const v = checkGoal(d, a, input);
  Object.assign(g, { title: v.title, description: v.description, category: v.category, employeeId: v.ownerType === 'employee' ? v.employeeId : null, departmentId: v.departmentId, cycleId: v.cycleId, startDate: v.startDate, dueDate: v.dueDate, target: v.target, priority: v.priority });
  g.history.push({ at: nowIso(), by: actor(scope), type: 'updated', from: null, to: null, note: '' });
  attachGoalToReview(d, g);
  return toGoal(d, a, g);
}

/** Progress 0–100 by the owner or their manager; "completed" means 100%; final statuses accept no more updates. */
export function updateGoalProgress(id: string, input: GoalProgressInput, scope: PerformanceScope): Goal {
  const { d, a } = begin(scope);
  const g = d.goals.find((x) => x.id === id) ?? notFound('Goal', id);
  if (!goalVisible(a, g)) forbidden();
  const view = toGoal(d, a, g);
  if (FINAL_GOAL_STATUSES.includes(g.status)) conflict(`Goal ${id} is ${g.status}`);
  if (!view.can.progress) forbidden('Only the owner or their manager can update progress');
  const errors = validateProgressInput(input);
  if (errors) invalid(errors);
  if (input.status === 'completed' && input.progress !== 100) invalid({ progress: ['completedNeeds100'] });
  if (input.status === 'not-started' && input.progress > 0) invalid({ status: ['startedHasProgress'] });
  const by = actor(scope);
  const when = nowIso();
  if (input.progress !== g.progress) g.history.push({ at: when, by, type: 'progress', from: String(g.progress), to: String(input.progress), note: input.note.trim() });
  if (input.status !== g.status) g.history.push({ at: when, by, type: 'status', from: g.status, to: input.status, note: input.progress === g.progress ? input.note.trim() : '' });
  g.progress = input.progress;
  g.status = input.status;
  return toGoal(d, a, g);
}

/* Reviews ----------------------------------------------------------------------------------------------------- */

function reviewView(d: Db, a: Access, r: ReviewRow): Review {
  const c = d.cycles.find((x) => x.id === r.cycleId)!;
  const e = empRow(r.employeeId)!;
  const own = r.employeeId === a.me;
  const evaluator = manages(a, r.employeeId);
  const open = OPEN_CYCLE_STATUSES.includes(c.status);
  const goals = d.goals.filter((g) => r.self.goalRatings.some((x) => x.goalId === g.id));
  const selfVisible = own || r.self.status === 'submitted';
  const managerVisible = (evaluator || a.kind === 'organization') ? true : own && r.manager.status === 'submitted';
  const selfReady = r.self.status === 'submitted' || todayIso() > c.selfAssessmentDeadline;
  const { reviewerName, ...manager } = r.manager;
  return {
    id: r.id,
    cycle: { id: c.id, name: c.name, status: c.status, selfAssessmentDeadline: c.selfAssessmentDeadline, managerReviewDeadline: c.managerReviewDeadline },
    employee: { ...employeeRef(r.employeeId), position: posRef(e.positionId) },
    reviewer: personRef(r.reviewerId),
    state: reviewState(r),
    goals: goals.map((g) => ({ id: g.id, title: g.title, target: g.target, progress: g.progress, status: g.status })),
    competencies: r.competencyIds.map((cid) => ({ id: cid, name: d.competencies.find((x) => x.id === cid)?.name ?? { en: cid, ar: cid } })),
    selfAssessment: selfVisible ? r.self : null,
    managerReview: managerVisible ? { ...manager, reviewer: reviewerName } : null,
    can: {
      selfAssess: own && open && r.self.status !== 'submitted',
      managerReview: evaluator && open && selfReady && r.manager.status !== 'submitted',
      reopen: a.write && open && (r.self.status === 'submitted' || r.manager.status === 'submitted'),
    },
  };
}

function toSummary(d: Db, a: Access, r: ReviewRow): ReviewSummary {
  const c = d.cycles.find((x) => x.id === r.cycleId)!;
  const own = r.employeeId === a.me;
  const ratingVisible = r.manager.status === 'submitted' && (own || manages(a, r.employeeId) || a.kind === 'organization');
  return {
    id: r.id,
    cycle: { id: c.id, name: c.name },
    employee: employeeRef(r.employeeId),
    reviewer: personRef(r.reviewerId),
    state: reviewState(r),
    selfStatus: r.self.status,
    managerStatus: r.manager.status,
    overallRating: ratingVisible ? r.manager.overallRating : null,
  };
}

export function listReviews(params: ListParams<ReviewFilters>, scope: PerformanceScope): Paginated<ReviewSummary> {
  const { d, a } = begin(scope);
  const f = params.filters ?? {};
  const units = f.departmentId ? new Set([f.departmentId, ...orgTables.descendants(f.departmentId)]) : null;
  const stateOrder: Record<ReviewState, number> = { 'pending-self': 0, 'pending-manager': 1, completed: 2 };
  const rows = d.reviews
    .filter((r) => {
      const c = d.cycles.find((x) => x.id === r.cycleId)!;
      if (c.status === 'draft' || !visibleEmployee(a, r.employeeId)) return false;
      if (f.cycleId && r.cycleId !== f.cycleId) return false;
      if (f.state && reviewState(r) !== f.state) return false;
      if (units && !units.has(empRow(r.employeeId)?.departmentId ?? '')) return false;
      // "Awaiting my review": reviews the caller can write NOW (same readiness rule as the manager review itself).
      const selfReady = r.self.status === 'submitted' || todayIso() > c.selfAssessmentDeadline;
      if (f.mine === 'true' && !(manages(a, r.employeeId) && OPEN_CYCLE_STATUSES.includes(c.status) && r.manager.status !== 'submitted' && selfReady)) return false;
      return true;
    })
    .map((r) => {
      const s = toSummary(d, a, r);
      return { ...s, 'employee.name.en': s.employee.name.en, 'employee.name.ar': s.employee.name.ar, stateOrder: stateOrder[s.state], search: `${s.employee.name.en} ${s.employee.name.ar} ${s.employee.employeeNumber}` };
    });
  const sortBy = params.sortBy === 'state' ? 'stateOrder' : params.sortBy;
  const page = queryCollection(rows, { ...params, sortBy, filters: {} }, { searchFields: ['search'] });
  return { ...page, items: page.items.map(({ 'employee.name.en': _e, 'employee.name.ar': _a, stateOrder: _s, search: _q, ...r }) => r) };
}

function visibleReview(a: Access, d: Db, id: string): ReviewRow {
  const r = d.reviews.find((x) => x.id === id) ?? notFound('Review', id);
  if (!visibleEmployee(a, r.employeeId)) forbidden();
  return r;
}

export function getReview(id: string, scope: PerformanceScope): Review {
  const { d, a } = begin(scope);
  return reviewView(d, a, visibleReview(a, d, id));
}

const scaleValues = (d: Db) => new Set(d.scale.map((l) => l.value));

function checkRatings(d: Db, ratings: Array<GoalRating | CompetencyRating>, field: string, errors: FieldErrors) {
  const values = scaleValues(d);
  ratings.forEach((x, i) => {
    if (x.rating !== null && !values.has(x.rating)) errors[`${field}.${i}.rating`] = ['ratingScale'];
  });
}

/** The employee's self-assessment: draft or submit; final once submitted (until HR reopens it). */
export function submitSelfAssessment(id: string, input: SelfAssessmentInput, scope: PerformanceScope): Review {
  const { d, a } = begin(scope);
  const r = visibleReview(a, d, id);
  if (r.employeeId !== a.me) forbidden('Only the employee can write their self-assessment');
  const c = d.cycles.find((x) => x.id === r.cycleId)!;
  if (!OPEN_CYCLE_STATUSES.includes(c.status)) conflict(`Cycle ${c.id} is ${c.status}`);
  if (r.self.status === 'submitted') conflict('The self-assessment is already submitted');
  const errors = validateSelfAssessment(input) ?? {};
  if (input.goalRatings.length !== r.self.goalRatings.length || input.goalRatings.some((x) => !r.self.goalRatings.some((y) => y.goalId === x.goalId))) errors.goalRatings = ['goalsChanged'];
  checkRatings(d, input.goalRatings, 'goalRatings', errors);
  if (Object.keys(errors).length) invalid(errors);
  r.self = { status: input.submit ? 'submitted' : 'draft', goalRatings: input.goalRatings.map((x) => ({ ...x, comment: x.comment.trim() })), achievements: input.achievements.trim(), challenges: input.challenges.trim(), comments: input.comments.trim(), submittedAt: input.submit ? nowIso() : null };
  syncCycleStatus(d, c);
  return reviewView(d, a, r);
}

/** The manager review (team reviewer or HR): draft or submit, with a rating on the configured scale. */
export function submitManagerReview(id: string, input: ManagerReviewInput, scope: PerformanceScope): Review {
  const { d, a } = begin(scope);
  const r = visibleReview(a, d, id);
  if (r.employeeId === a.me) forbidden('You cannot review yourself');
  if (!manages(a, r.employeeId)) forbidden('Outside your review scope');
  const c = d.cycles.find((x) => x.id === r.cycleId)!;
  if (!OPEN_CYCLE_STATUSES.includes(c.status)) conflict(`Cycle ${c.id} is ${c.status}`);
  if (r.manager.status === 'submitted') conflict('The manager review is already submitted');
  if (r.self.status !== 'submitted' && todayIso() <= c.selfAssessmentDeadline) invalid({ form: ['selfPending'] });
  const errors = validateManagerReview(input) ?? {};
  if (input.competencyRatings.length !== r.competencyIds.length || input.competencyRatings.some((x) => !r.competencyIds.includes(x.competencyId))) errors.competencyRatings = ['competenciesChanged'];
  checkRatings(d, input.goalRatings, 'goalRatings', errors);
  checkRatings(d, input.competencyRatings, 'competencyRatings', errors);
  if (input.overallRating !== null && !scaleValues(d).has(input.overallRating)) errors.overallRating = ['ratingScale'];
  if (Object.keys(errors).length) invalid(errors);
  r.manager = {
    status: input.submit ? 'submitted' : 'draft',
    goalRatings: input.goalRatings.map((x) => ({ ...x, comment: x.comment.trim() })),
    competencyRatings: input.competencyRatings.map((x) => ({ ...x, comment: x.comment.trim() })),
    strengths: input.strengths.trim(),
    improvements: input.improvements.trim(),
    development: input.development.trim(),
    comments: input.comments.trim(),
    overallRating: input.overallRating,
    submittedAt: input.submit ? nowIso() : null,
    reviewerName: actor(scope),
  };
  syncCycleStatus(d, c);
  return reviewView(d, a, r);
}

/** HR reopens a submitted self-assessment or manager review (explicit operation) in an open cycle. */
export function reopenReview(id: string, part: 'self' | 'manager', scope: PerformanceScope): Review {
  const { d, a } = begin(scope);
  const r = visibleReview(a, d, id);
  if (!a.write) forbidden('performance:write is required');
  const c = d.cycles.find((x) => x.id === r.cycleId)!;
  if (!OPEN_CYCLE_STATUSES.includes(c.status) && c.status !== 'completed') conflict(`Cycle ${c.id} is ${c.status}`);
  const target = part === 'self' ? r.self : r.manager;
  if (target.status !== 'submitted') conflict('Nothing to reopen');
  target.status = 'draft';
  target.submittedAt = null;
  if (part === 'self' && r.manager.status === 'submitted') {
    r.manager.status = 'draft';
    r.manager.submittedAt = null;
  }
  syncCycleStatus(d, c);
  return reviewView(d, a, r);
}

/* Development plans ------------------------------------------------------------------------------------------- */

const planProgress = (p: PlanRow) => (p.activities.length ? Math.round((p.activities.filter((x) => x.status === 'done').length / p.activities.length) * 100) : 0);

function toPlan(d: Db, a: Access, p: PlanRow): DevelopmentPlan {
  const cycle = p.cycleId ? d.cycles.find((c) => c.id === p.cycleId) : undefined;
  const open = p.status === 'draft' || p.status === 'active';
  return {
    id: p.id,
    employee: employeeRef(p.employeeId),
    title: p.title,
    objectives: p.objectives,
    activities: p.activities,
    targetDate: p.targetDate,
    progress: planProgress(p),
    status: p.status,
    cycle: cycle ? { id: cycle.id, name: cycle.name } : null,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
    can: { edit: open && manages(a, p.employeeId), updateActivities: p.status === 'active' && (manages(a, p.employeeId) || p.employeeId === a.me) },
  };
}

export function listPlans(params: ListParams<PlanFilters>, scope: PerformanceScope): Paginated<DevelopmentPlan> {
  const { d, a } = begin(scope);
  const f = params.filters ?? {};
  const units = f.departmentId ? new Set([f.departmentId, ...orgTables.descendants(f.departmentId)]) : null;
  const rows = d.plans
    .filter((p) => visibleEmployee(a, p.employeeId) && (!f.status || p.status === f.status) && (!f.employeeId || p.employeeId === f.employeeId) && (!units || units.has(empRow(p.employeeId)?.departmentId ?? '')))
    .map((p) => {
      const v = toPlan(d, a, p);
      return { ...v, 'employee.name.en': v.employee.name.en, 'employee.name.ar': v.employee.name.ar, search: `${v.title} ${v.employee.name.en} ${v.employee.name.ar} ${v.employee.employeeNumber}` };
    });
  const page = queryCollection(rows, { ...params, filters: {} }, { searchFields: ['search'] });
  return { ...page, items: page.items.map(({ 'employee.name.en': _e, 'employee.name.ar': _a, search: _s, ...p }) => p) };
}

export function getPlan(id: string, scope: PerformanceScope): DevelopmentPlan {
  const { d, a } = begin(scope);
  const p = d.plans.find((x) => x.id === id) ?? notFound('Plan', id);
  if (!visibleEmployee(a, p.employeeId)) forbidden();
  return toPlan(d, a, p);
}

const PLAN_TRANSITIONS: Record<PlanStatus, readonly PlanStatus[]> = { draft: ['draft', 'active', 'cancelled'], active: ['active', 'completed', 'cancelled'], completed: [], cancelled: [] };

function checkPlan(d: Db, a: Access, input: PlanInput, current?: PlanRow) {
  const errors = validatePlanInput(input);
  if (errors) invalid(errors);
  const e = empRow(input.employeeId);
  if (!e || e.status !== 'active') invalid({ employeeId: ['inactiveEmployee'] });
  if (!manages(a, e.id)) forbidden('Outside your team');
  if (current && !PLAN_TRANSITIONS[current.status].includes(input.status)) conflict(`Plan ${current.id} cannot go from ${current.status} to ${input.status}`);
  if (!current && input.status !== 'draft' && input.status !== 'active') invalid({ status: ['invalidStatus'] });
  if (input.status === 'completed' && input.activities.some((x) => x.status !== 'done')) invalid({ status: ['activitiesOpen'] });
  if (input.cycleId && !d.cycles.some((c) => c.id === input.cycleId)) invalid({ cycleId: ['notFound'] });
}

export function createPlan(input: PlanInput, scope: PerformanceScope): DevelopmentPlan {
  const { d, a } = begin(scope);
  checkPlan(d, a, input);
  d.seq.plan++;
  const when = nowIso();
  const row: PlanRow = {
    id: `pln-${pad(d.seq.plan, 3)}`,
    employeeId: input.employeeId,
    title: input.title.trim(),
    objectives: input.objectives.map((o) => o.trim()),
    activities: input.activities.map((x) => ({ ...x, id: `act-${pad(++d.seq.activity, 4)}`, title: x.title.trim() })),
    targetDate: input.targetDate,
    status: input.status,
    cycleId: input.cycleId,
    createdAt: when,
    updatedAt: when,
  };
  d.plans.push(row);
  return toPlan(d, a, row);
}

export function updatePlan(id: string, input: PlanInput, scope: PerformanceScope): DevelopmentPlan {
  const { d, a } = begin(scope);
  const p = d.plans.find((x) => x.id === id) ?? notFound('Plan', id);
  if (!visibleEmployee(a, p.employeeId)) forbidden();
  if (input.employeeId !== p.employeeId) invalid({ employeeId: ['employeeLocked'] });
  checkPlan(d, a, input, p);
  Object.assign(p, {
    title: input.title.trim(),
    objectives: input.objectives.map((o) => o.trim()),
    activities: input.activities.map((x) => ({ ...x, id: x.id && p.activities.some((y) => y.id === x.id) ? x.id : `act-${pad(++d.seq.activity, 4)}`, title: x.title.trim() })),
    targetDate: input.targetDate,
    status: input.status,
    cycleId: input.cycleId,
    updatedAt: nowIso(),
  });
  return toPlan(d, a, p);
}

/** The employee (or their manager) updates activity statuses of an active plan. */
export function updatePlanActivities(id: string, changes: Array<{ id: string; status: PlanActivity['status'] }>, scope: PerformanceScope): DevelopmentPlan {
  const { d, a } = begin(scope);
  const p = d.plans.find((x) => x.id === id) ?? notFound('Plan', id);
  if (!visibleEmployee(a, p.employeeId)) forbidden();
  if (!toPlan(d, a, p).can.updateActivities) {
    if (p.status === 'active') forbidden();
    conflict(`Plan ${id} is ${p.status}`);
  }
  for (const ch of changes) {
    const act = p.activities.find((x) => x.id === ch.id);
    if (!act) invalid({ activities: ['notFound'] });
    act.status = ch.status;
  }
  p.updatedAt = nowIso();
  return toPlan(d, a, p);
}

/* Overview, history, options ------------------------------------------------------------------------------------ */

export function summary(scope: PerformanceScope): PerformanceSummary {
  const { d, a } = begin(scope);
  const current = d.cycles.filter((c) => CURRENT_CYCLE_STATUSES.includes(c.status));
  const open = d.cycles.filter((c) => OPEN_CYCLE_STATUSES.includes(c.status));
  const inScope = (r: ReviewRow) => visibleEmployee(a, r.employeeId);
  const openReviews = d.reviews.filter((r) => open.some((c) => c.id === r.cycleId) && inScope(r));
  const currentReviews = d.reviews.filter((r) => current.some((c) => c.id === r.cycleId) && inScope(r));
  const done = currentReviews.filter((r) => r.manager.status === 'submitted' && r.manager.overallRating !== null);
  const departments = new Map<string, number[]>();
  for (const r of done) {
    const top = topLevel(empRow(r.employeeId)?.departmentId ?? '');
    departments.set(top, [...(departments.get(top) ?? []), r.manager.overallRating!]);
  }
  const visibleCycles = d.cycles.filter((c) => c.status !== 'draft' && cycleVisible(a, c)).sort((x, y) => x.periodStart.localeCompare(y.periodStart));
  return {
    inReview: new Set(openReviews.map((r) => r.employeeId)).size,
    activeCycles: open.filter((c) => cycleVisible(a, c)).length,
    pendingSelf: openReviews.filter((r) => r.self.status !== 'submitted').length,
    pendingManager: openReviews.filter((r) => r.self.status === 'submitted' && r.manager.status !== 'submitted').length,
    completed: openReviews.filter((r) => r.manager.status === 'submitted').length,
    averageRating: average(openReviews.filter((r) => r.manager.status === 'submitted' && r.manager.overallRating !== null).map((r) => r.manager.overallRating!)),
    distribution: d.scale.map((l) => ({ value: l.value, count: done.filter((r) => r.manager.overallRating === l.value).length })),
    completion: current
      .filter((c) => cycleVisible(a, c))
      .map((c) => {
        const rs = currentReviews.filter((r) => r.cycleId === c.id);
        return { cycle: { id: c.id, name: c.name }, completed: rs.filter((r) => r.manager.status === 'submitted').length, pendingManager: rs.filter((r) => r.self.status === 'submitted' && r.manager.status !== 'submitted').length, pendingSelf: rs.filter((r) => r.self.status !== 'submitted').length };
      }),
    byDepartment: [...departments.entries()].map(([id, values]) => ({ department: deptRef(id), average: average(values)!, reviews: values.length })).sort((x, y) => y.average - x.average),
    trend: visibleCycles.map((c) => {
      const values = d.reviews.filter((r) => r.cycleId === c.id && inScope(r) && r.manager.status === 'submitted' && r.manager.overallRating !== null).map((r) => r.manager.overallRating!);
      return { cycle: { id: c.id, name: c.name }, average: average(values), reviews: values.length };
    }),
    scale: d.scale,
  };
}

export function employeeHistory(requested: string, scope: PerformanceScope): EmployeePerformanceHistory {
  const { d, a } = begin(scope);
  const id = requested === 'me' ? (a.me ?? '') : requested;
  const e = empRow(id) ?? notFound('Employee', id);
  if (!visibleEmployee(a, id)) forbidden();
  const reviews = d.reviews
    .filter((r) => r.employeeId === id && d.cycles.find((c) => c.id === r.cycleId)!.status !== 'draft')
    .map((r) => {
      const c = d.cycles.find((x) => x.id === r.cycleId)!;
      return { ...toSummary(d, a, r), cycleStatus: c.status, periodStart: c.periodStart, periodEnd: c.periodEnd };
    })
    .sort((x, y) => y.periodStart.localeCompare(x.periodStart));
  return {
    employee: { ...employeeRef(id), position: posRef(e.positionId) },
    reviews,
    goals: d.goals.filter((g) => g.employeeId === id).map((g) => toGoal(d, a, g)).sort((x, y) => y.dueDate.localeCompare(x.dueDate)),
    plans: d.plans.filter((p) => p.employeeId === id).map((p) => toPlan(d, a, p)),
  };
}

/** Active employees the caller may manage (goal owners, plan owners) — or, for configuration, everyone. */
export function employeeOptions(search: string, purpose: 'manage' | 'participants', scope: PerformanceScope): EmployeeOption[] {
  const { a } = begin(scope);
  if (purpose === 'participants') requireConfig(a);
  else if (!a.write && !a.teamReview) forbidden();
  const term = search.trim().toLowerCase();
  return employeeRecords
    .all()
    .filter((e) => e.status === 'active' && (purpose === 'participants' || manages(a, e.id)))
    .filter((e) => {
      const n = employeeRecords.fullName(e);
      return !term || n.en.toLowerCase().includes(term) || n.ar.includes(term) || e.employeeNumber.toLowerCase().includes(term);
    })
    .slice(0, 20)
    .map((e) => employeeRef(e.id));
}

/** Participants of a cycle (paged, within scope). */
export function cycleParticipants(id: string, params: ListParams<{ state: ReviewState }>, scope: PerformanceScope): Paginated<ReviewSummary | (ReviewSummary & { pending: true })> {
  const { d, a } = begin(scope);
  const c = visibleCycle(a, d, id);
  if (c.status === 'draft') {
    const rows = c.participantIds
      .filter((eid) => visibleEmployee(a, eid))
      .map((eid) => ({ id: `${c.id}|${eid}`, cycle: { id: c.id, name: c.name }, employee: employeeRef(eid), reviewer: personRef(reviewerOf(empRow(eid)!)), state: 'pending-self' as ReviewState, selfStatus: 'not-started' as AssessmentStatus, managerStatus: 'not-started' as AssessmentStatus, overallRating: null, pending: true as const }));
    return queryCollection(rows, { ...params, filters: {} });
  }
  return listReviews({ ...params, filters: { cycleId: id, state: params.filters?.state } }, scope);
}
