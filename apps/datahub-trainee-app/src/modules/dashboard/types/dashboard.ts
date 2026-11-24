import type { ActivityType, EnrollmentStatus } from '@/core/domain/training';

export type { ActivityType };

export interface DeadlineDto {
  id: string;
  /** A training's end date, or an assignment's closing time. */
  kind: 'training' | 'assignment';
  title: string;
  trainingId: string;
  trainingTitle: string;
  /** ISO date or date-time. */
  dueAt: string;
}

export interface ActivityDto {
  id: string;
  type: ActivityType;
  at: string;
  actorName: string;
  trainingId: string | null;
  trainingTitle: string | null;
  userName: string | null;
  /** Progress percentage, for `progress-updated`. */
  progress: number | null;
}

export interface StatusBreakdown {
  assigned: number;
  inProgress: number;
  completed: number;
}

export interface TrainingProgressEntry {
  trainingId: string;
  title: string;
  enrollments: number;
  completed: number;
  /** 0–100 average of the enrollments' progress. */
  averageProgress: number;
}

/** SuperAdmin / DepartmentAdmin: the training programme of their scope (all, or one department). */
export interface ManagerDashboard {
  kind: 'manager';
  /** Set for a DepartmentAdmin. */
  scopeDepartmentName: string | null;
  stats: {
    totalTrainings: number;
    publishedTrainings: number;
    totalEnrollments: number;
    /** Active people with at least one enrollment that is not completed. */
    activeTrainees: number;
    completedEnrollments: number;
    /** Completed ÷ total enrollments, 0–100. */
    completionRate: number;
  };
  statusBreakdown: StatusBreakdown;
  trainingProgress: TrainingProgressEntry[];
  deadlines: DeadlineDto[];
}

export interface CurrentTraining {
  trainingId: string;
  title: string;
  status: EnrollmentStatus;
  progress: number;
  endDate: string | null;
}

/** Trainee / Employee / Intern: their own trainings. */
export interface LearnerDashboard {
  kind: 'learner';
  stats: {
    enrolled: number;
    inProgress: number;
    completed: number;
    /** Average progress over all their enrollments, 0–100. */
    averageProgress: number;
    certificates: number;
  };
  current: CurrentTraining[];
  deadlines: DeadlineDto[];
}

export type DashboardDto = ManagerDashboard | LearnerDashboard;
