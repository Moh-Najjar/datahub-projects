import { mockRequest } from '@/core/api/mock/mockRequest';
import type { ListParams, Paginated } from '@/core/api/types';
import * as mock from '@/modules/performance/mock/performanceMock';
import type {
  Competency,
  CompetencyFilters,
  CompetencyInput,
  CycleFilters,
  CycleInput,
  CycleStatus,
  DevelopmentPlan,
  EmployeeOption,
  EmployeePerformanceHistory,
  Goal,
  GoalFilters,
  GoalInput,
  GoalProgressInput,
  ManagerReviewInput,
  PerformanceScope,
  PerformanceSummary,
  PlanActivity,
  PlanFilters,
  PlanInput,
  RatingLevel,
  RecordStatus,
  Review,
  ReviewCycle,
  ReviewFilters,
  ReviewState,
  ReviewSummary,
  ReviewTemplate,
  SelfAssessmentInput,
  TemplateInput,
} from '@/modules/performance/types/performance';

/*
 * Performance API service — the ONLY entry point to performance data. Every call runs against the SIMULATED backend
 * (`mock/`); with the .NET backend each body becomes an HTTP call returning the same types (no URLs are invented before
 * the contract exists). `scope` exists only because the mock has no token.
 */

type Signal = AbortSignal | undefined;

export const performanceApi = {
  getPerformanceSummary: (scope: PerformanceScope, signal?: Signal): Promise<PerformanceSummary> => mockRequest(() => mock.summary(scope), { signal }),

  /* Review cycles */
  getReviewCycles: (params: ListParams<CycleFilters>, scope: PerformanceScope, signal?: Signal): Promise<Paginated<ReviewCycle>> => mockRequest(() => mock.listCycles(params, scope), { signal }),
  getReviewCycleById: (id: string, scope: PerformanceScope, signal?: Signal): Promise<ReviewCycle> => mockRequest(() => mock.getCycle(id, scope), { signal }),
  createReviewCycle: (input: CycleInput, scope: PerformanceScope): Promise<ReviewCycle> => mockRequest(() => mock.createCycle(input, scope)),
  updateReviewCycle: (id: string, input: CycleInput, scope: PerformanceScope): Promise<ReviewCycle> => mockRequest(() => mock.updateCycle(id, input, scope)),
  updateReviewCycleStatus: (id: string, status: CycleStatus, note: string, scope: PerformanceScope): Promise<ReviewCycle> => mockRequest(() => mock.updateCycleStatus(id, status, note, scope)),
  assignCycleParticipants: (id: string, change: { add: string[]; remove: string[] }, scope: PerformanceScope): Promise<ReviewCycle> => mockRequest(() => mock.assignParticipants(id, change, scope)),
  getCycleParticipants: (id: string, params: ListParams<{ state: ReviewState }>, scope: PerformanceScope, signal?: Signal): Promise<Paginated<ReviewSummary>> => mockRequest(() => mock.cycleParticipants(id, params, scope), { signal }),

  /* Goals */
  getGoals: (params: ListParams<GoalFilters>, scope: PerformanceScope, signal?: Signal): Promise<Paginated<Goal>> => mockRequest(() => mock.listGoals(params, scope), { signal }),
  getGoalById: (id: string, scope: PerformanceScope, signal?: Signal): Promise<Goal> => mockRequest(() => mock.getGoal(id, scope), { signal }),
  createGoal: (input: GoalInput, scope: PerformanceScope): Promise<Goal> => mockRequest(() => mock.createGoal(input, scope)),
  updateGoal: (id: string, input: GoalInput, scope: PerformanceScope): Promise<Goal> => mockRequest(() => mock.updateGoal(id, input, scope)),
  updateGoalProgress: (id: string, input: GoalProgressInput, scope: PerformanceScope): Promise<Goal> => mockRequest(() => mock.updateGoalProgress(id, input, scope)),

  /* Self-assessments and manager reviews */
  getReviews: (params: ListParams<ReviewFilters>, scope: PerformanceScope, signal?: Signal): Promise<Paginated<ReviewSummary>> => mockRequest(() => mock.listReviews(params, scope), { signal }),
  /** Self-assessments = the caller's own reviews (`employeeId` = me), manager reviews = reviews of their team. */
  getSelfAssessments: (scope: PerformanceScope, signal?: Signal): Promise<EmployeePerformanceHistory['reviews']> => mockRequest(() => mock.employeeHistory('me', scope).reviews, { signal }),
  getManagerReviews: (params: ListParams<ReviewFilters>, scope: PerformanceScope, signal?: Signal): Promise<Paginated<ReviewSummary>> => mockRequest(() => mock.listReviews({ ...params, filters: { ...params.filters, mine: 'true' } }, scope), { signal }),
  getReviewById: (id: string, scope: PerformanceScope, signal?: Signal): Promise<Review> => mockRequest(() => mock.getReview(id, scope), { signal }),
  submitSelfAssessment: (id: string, input: SelfAssessmentInput, scope: PerformanceScope): Promise<Review> => mockRequest(() => mock.submitSelfAssessment(id, input, scope)),
  submitManagerReview: (id: string, input: ManagerReviewInput, scope: PerformanceScope): Promise<Review> => mockRequest(() => mock.submitManagerReview(id, input, scope)),
  /** Explicit reopening of a submitted self-assessment or manager review (HR). */
  reopenReview: (id: string, part: 'self' | 'manager', scope: PerformanceScope): Promise<Review> => mockRequest(() => mock.reopenReview(id, part, scope)),

  /* Competencies, templates, rating scale */
  getCompetencies: (params: ListParams<CompetencyFilters>, scope: PerformanceScope, signal?: Signal): Promise<Paginated<Competency>> => mockRequest(() => mock.listCompetencies(params, scope), { signal }),
  createCompetency: (input: CompetencyInput, scope: PerformanceScope): Promise<Competency> => mockRequest(() => mock.createCompetency(input, scope)),
  updateCompetency: (id: string, input: CompetencyInput, scope: PerformanceScope): Promise<Competency> => mockRequest(() => mock.updateCompetency(id, input, scope)),
  updateCompetencyStatus: (id: string, status: RecordStatus, scope: PerformanceScope): Promise<Competency> => mockRequest(() => mock.updateCompetencyStatus(id, status, scope)),
  getReviewTemplates: (scope: PerformanceScope, signal?: Signal): Promise<ReviewTemplate[]> => mockRequest(() => mock.listTemplates(scope), { signal }),
  createReviewTemplate: (input: TemplateInput, scope: PerformanceScope): Promise<ReviewTemplate> => mockRequest(() => mock.createTemplate(input, scope)),
  updateReviewTemplate: (id: string, input: TemplateInput, scope: PerformanceScope): Promise<ReviewTemplate> => mockRequest(() => mock.updateTemplate(id, input, scope)),
  getRatingScale: (scope: PerformanceScope, signal?: Signal): Promise<RatingLevel[]> => mockRequest(() => mock.ratingScale(scope), { signal }),
  updateRatingScale: (levels: RatingLevel[], scope: PerformanceScope): Promise<RatingLevel[]> => mockRequest(() => mock.updateRatingScale(levels, scope)),

  /* Development plans */
  getDevelopmentPlans: (params: ListParams<PlanFilters>, scope: PerformanceScope, signal?: Signal): Promise<Paginated<DevelopmentPlan>> => mockRequest(() => mock.listPlans(params, scope), { signal }),
  getDevelopmentPlanById: (id: string, scope: PerformanceScope, signal?: Signal): Promise<DevelopmentPlan> => mockRequest(() => mock.getPlan(id, scope), { signal }),
  createDevelopmentPlan: (input: PlanInput, scope: PerformanceScope): Promise<DevelopmentPlan> => mockRequest(() => mock.createPlan(input, scope)),
  updateDevelopmentPlan: (id: string, input: PlanInput, scope: PerformanceScope): Promise<DevelopmentPlan> => mockRequest(() => mock.updatePlan(id, input, scope)),
  updatePlanActivities: (id: string, changes: Array<{ id: string; status: PlanActivity['status'] }>, scope: PerformanceScope): Promise<DevelopmentPlan> => mockRequest(() => mock.updatePlanActivities(id, changes, scope)),

  /* History and options */
  /** `employeeId = 'me'` → the signed-in user's own history. */
  getEmployeePerformanceHistory: (employeeId: string, scope: PerformanceScope, signal?: Signal): Promise<EmployeePerformanceHistory> => mockRequest(() => mock.employeeHistory(employeeId, scope), { signal }),
  getEmployeeOptions: (search: string, purpose: 'manage' | 'participants', scope: PerformanceScope, signal?: Signal): Promise<EmployeeOption[]> => mockRequest(() => mock.employeeOptions(search, purpose, scope), { signal }),
};
