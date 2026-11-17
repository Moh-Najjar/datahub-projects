import type { Localized } from '@datahub/shared-types';
import type { Role } from '@/core/config/permissions';

/*
 * Performance contracts — a DRAFT of what the future .NET backend should return. The mock API returns exactly these
 * shapes. Employees and departments are Employee / Organization Management ids. Dates are local `YYYY-MM-DD`,
 * timestamps ISO. Ratings use the CONFIGURABLE rating scale (default 1–5); the labels and descriptions are examples,
 * not a company policy.
 */

export interface NamedRef {
  id: string;
  name: Localized<string>;
}

export type RecordStatus = 'active' | 'inactive';

export interface EmployeeRef extends NamedRef {
  employeeNumber: string;
  department: NamedRef;
}

/* Rating scale ------------------------------------------------------------------------------------------ */

export interface RatingLevel {
  value: number;
  label: Localized<string>;
  description: Localized<string>;
}

/* Competencies & templates ------------------------------------------------------------------------------ */

export interface Competency {
  id: string;
  code: string;
  name: Localized<string>;
  description: string;
  /** What each rating means for this competency (configurable guidance). */
  criteria: string;
  status: RecordStatus;
  createdAt: string;
  /** Templates using it. */
  templateCount: number;
}

export interface CompetencyInput {
  code: string;
  name: Localized<string>;
  description: string;
  criteria: string;
}

export interface CompetencyFilters {
  status: RecordStatus;
}

export type CompetencySortField = 'code' | 'name.en' | 'name.ar' | 'status';

export interface ReviewTemplate {
  id: string;
  name: Localized<string>;
  competencies: NamedRef[];
  status: RecordStatus;
  createdAt: string;
}

export interface TemplateInput {
  name: Localized<string>;
  competencyIds: string[];
}

/* Review cycles ----------------------------------------------------------------------------------------- */

export const CYCLE_STATUSES = ['draft', 'active', 'in-progress', 'completed', 'closed'] as const;
export type CycleStatus = (typeof CYCLE_STATUSES)[number];

export interface ReviewCycle {
  id: string;
  name: Localized<string>;
  description: string;
  /** Working window of the cycle. */
  startDate: string;
  endDate: string;
  /** The period whose performance is reviewed. */
  periodStart: string;
  periodEnd: string;
  selfAssessmentDeadline: string;
  managerReviewDeadline: string;
  template: NamedRef;
  status: CycleStatus;
  createdAt: string;
  history: Array<{ at: string; by: Localized<string>; from: CycleStatus | null; to: CycleStatus; note: string }>;
  /** Participants in the caller's scope (team scope sees its team only). */
  participants: number;
  progress: { selfSubmitted: number; managerSubmitted: number; total: number };
  nextStatuses: CycleStatus[];
  can: { edit: boolean; assign: boolean };
}

export interface CycleInput {
  name: Localized<string>;
  description: string;
  startDate: string;
  endDate: string;
  periodStart: string;
  periodEnd: string;
  selfAssessmentDeadline: string;
  managerReviewDeadline: string;
  templateId: string;
}

export interface CycleFilters {
  status: CycleStatus;
}

export type CycleSortField = 'startDate' | 'name.en' | 'name.ar' | 'status';

/* Goals ------------------------------------------------------------------------------------------------- */

export const GOAL_CATEGORIES = ['business', 'technical', 'leadership', 'personal-development'] as const;
export type GoalCategory = (typeof GOAL_CATEGORIES)[number];

export const GOAL_STATUSES = ['not-started', 'in-progress', 'at-risk', 'completed', 'cancelled'] as const;
export type GoalStatus = (typeof GOAL_STATUSES)[number];

export const PRIORITIES = ['low', 'medium', 'high'] as const;
export type Priority = (typeof PRIORITIES)[number];

export interface GoalEvent {
  at: string;
  by: Localized<string>;
  type: 'created' | 'updated' | 'progress' | 'status';
  from: string | null;
  to: string | null;
  note: string;
}

export interface Goal {
  id: string;
  title: string;
  description: string;
  category: GoalCategory;
  /** An employee goal (`owner`) or a department goal (`owner = null`). */
  owner: EmployeeRef | null;
  department: NamedRef;
  cycle: NamedRef | null;
  startDate: string;
  dueDate: string;
  /** Measurable target, e.g. "Reduce response time to 4 h". */
  target: string;
  /** 0–100. */
  progress: number;
  priority: Priority;
  status: GoalStatus;
  createdAt: string;
  history: GoalEvent[];
  can: { edit: boolean; progress: boolean };
}

export interface GoalInput {
  title: string;
  description: string;
  category: GoalCategory;
  ownerType: 'employee' | 'department';
  employeeId: string | null;
  departmentId: string;
  cycleId: string | null;
  startDate: string;
  dueDate: string;
  target: string;
  priority: Priority;
}

export interface GoalProgressInput {
  progress: number;
  status: GoalStatus;
  note: string;
}

export interface GoalFilters {
  status: GoalStatus;
  category: GoalCategory;
  cycleId: string;
  departmentId: string;
  employeeId: string;
  ownerType: 'employee' | 'department';
}

export type GoalSortField = 'title' | 'dueDate' | 'progress' | 'priority' | 'status';

/* Reviews (self-assessment + manager review) ----------------------------------------------------------- */

export type AssessmentStatus = 'not-started' | 'draft' | 'submitted';
export const REVIEW_STATES = ['pending-self', 'pending-manager', 'completed'] as const;
export type ReviewState = (typeof REVIEW_STATES)[number];

export interface GoalRating {
  goalId: string;
  rating: number | null;
  comment: string;
}

export interface CompetencyRating {
  competencyId: string;
  rating: number | null;
  comment: string;
}

export interface SelfAssessment {
  status: AssessmentStatus;
  goalRatings: GoalRating[];
  achievements: string;
  challenges: string;
  comments: string;
  submittedAt: string | null;
}

export interface ManagerReview {
  status: AssessmentStatus;
  goalRatings: GoalRating[];
  competencyRatings: CompetencyRating[];
  strengths: string;
  improvements: string;
  development: string;
  comments: string;
  overallRating: number | null;
  submittedAt: string | null;
  reviewer: Localized<string> | null;
}

export interface Review {
  id: string;
  cycle: NamedRef & { status: CycleStatus; selfAssessmentDeadline: string; managerReviewDeadline: string };
  employee: EmployeeRef & { position: NamedRef };
  /** The assigned reviewer (the employee's manager when the cycle started). */
  reviewer: NamedRef | null;
  state: ReviewState;
  /** Goals of the employee in this cycle. */
  goals: Array<{ id: string; title: string; target: string; progress: number; status: GoalStatus }>;
  competencies: NamedRef[];
  /** `null` = not visible to the caller (a manager sees a self-assessment only once submitted). */
  selfAssessment: SelfAssessment | null;
  /** `null` = not visible to the caller (the employee sees it only once submitted). */
  managerReview: ManagerReview | null;
  can: { selfAssess: boolean; managerReview: boolean; reopen: boolean };
}

export interface ReviewSummary {
  id: string;
  cycle: NamedRef;
  employee: EmployeeRef;
  reviewer: NamedRef | null;
  state: ReviewState;
  selfStatus: AssessmentStatus;
  managerStatus: AssessmentStatus;
  /** Shown only when the manager review is submitted and visible to the caller. */
  overallRating: number | null;
}

export interface ReviewFilters {
  cycleId: string;
  state: ReviewState;
  departmentId: string;
  /** Only reviews the caller is expected to write (manager reviews of their team). */
  mine: 'true';
}

export type ReviewSortField = 'employee.name.en' | 'employee.name.ar' | 'state' | 'overallRating';

export interface SelfAssessmentInput {
  goalRatings: GoalRating[];
  achievements: string;
  challenges: string;
  comments: string;
  /** `false` saves a draft. */
  submit: boolean;
}

export interface ManagerReviewInput {
  goalRatings: GoalRating[];
  competencyRatings: CompetencyRating[];
  strengths: string;
  improvements: string;
  development: string;
  comments: string;
  overallRating: number | null;
  submit: boolean;
}

/* Development plans ------------------------------------------------------------------------------------- */

export const PLAN_STATUSES = ['draft', 'active', 'completed', 'cancelled'] as const;
export type PlanStatus = (typeof PLAN_STATUSES)[number];

export const ACTIVITY_TYPES = ['training', 'mentoring', 'certification', 'technical', 'leadership'] as const;
export type ActivityType = (typeof ACTIVITY_TYPES)[number];

export const ACTIVITY_STATUSES = ['planned', 'in-progress', 'done'] as const;
export type ActivityStatus = (typeof ACTIVITY_STATUSES)[number];

export interface PlanActivity {
  id: string;
  type: ActivityType;
  title: string;
  targetDate: string;
  status: ActivityStatus;
}

export interface DevelopmentPlan {
  id: string;
  employee: EmployeeRef;
  title: string;
  objectives: string[];
  activities: PlanActivity[];
  targetDate: string;
  /** Share of activities done (0–100). */
  progress: number;
  status: PlanStatus;
  cycle: NamedRef | null;
  createdAt: string;
  updatedAt: string;
  can: { edit: boolean; updateActivities: boolean };
}

export interface PlanInput {
  employeeId: string;
  title: string;
  objectives: string[];
  activities: Array<Omit<PlanActivity, 'id'> & { id?: string }>;
  targetDate: string;
  status: PlanStatus;
  cycleId: string | null;
}

export interface PlanFilters {
  status: PlanStatus;
  employeeId: string;
  departmentId: string;
}

export type PlanSortField = 'employee.name.en' | 'employee.name.ar' | 'targetDate' | 'progress' | 'status';

/* Overview & history ------------------------------------------------------------------------------------ */

export interface PerformanceSummary {
  /** Participants of active / in-progress cycles. */
  inReview: number;
  activeCycles: number;
  pendingSelf: number;
  pendingManager: number;
  /** Completed reviews of active / in-progress cycles. */
  completed: number;
  /** Average overall rating of completed reviews in active / in-progress cycles (`null` when none). */
  averageRating: number | null;
  /** Completed reviews per rating value (current cycles). */
  distribution: Array<{ value: number; count: number }>;
  /** Per current cycle: completed / awaiting manager / awaiting self. */
  completion: Array<{ cycle: NamedRef; completed: number; pendingManager: number; pendingSelf: number }>;
  /** Average rating per top-level department (completed reviews, current cycles). */
  byDepartment: Array<{ department: NamedRef; average: number; reviews: number }>;
  /** Average rating per cycle (completed reviews), oldest first. */
  trend: Array<{ cycle: NamedRef; average: number | null; reviews: number }>;
  scale: RatingLevel[];
}

export interface EmployeePerformanceHistory {
  employee: EmployeeRef & { position: NamedRef };
  reviews: Array<ReviewSummary & { cycleStatus: CycleStatus; periodStart: string; periodEnd: string }>;
  goals: Goal[];
  plans: DevelopmentPlan[];
}

/** Employee option for goal / plan owners and cycle participants (within the caller's scope). */
export type EmployeeOption = EmployeeRef;

/* Scope ------------------------------------------------------------------------------------------------- */

/**
 * Who is asking: `organization` (performance:read), `team` (performance:read:team — the departments the user manages,
 * plus their own records) or `own` (performance:read:own). The real backend derives it from the token.
 */
export interface PerformanceScope {
  kind: 'organization' | 'team' | 'own';
  userId: string;
  role: Role;
}
