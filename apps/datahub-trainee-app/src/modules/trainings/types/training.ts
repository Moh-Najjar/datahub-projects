import type { EnrollmentStatus, Role, TrainingStatus } from '@/core/domain/training';

export type { TrainingStatus };

export interface MyEnrollment {
  id: string;
  status: EnrollmentStatus;
  progress: number;
  completedAt: string | null;
}

export interface TrainingDto {
  id: string;
  title: string;
  description: string;
  status: TrainingStatus;
  sortOrder: number;
  departmentId: string;
  departmentName: string | null;
  trainerId: string | null;
  trainerName: string | null;
  /** ISO dates (`yyyy-MM-dd`); optional. */
  startDate: string | null;
  endDate: string | null;
  durationHours: number | null;
  materialCount: number;
  assignmentCount: number;
  enrollmentCount: number;
  completedCount: number;
  createdAt: string;
  /** The caller's own enrollment (learners); null for people who are not enrolled. */
  myEnrollment: MyEnrollment | null;
}

export interface TrainingFilters {
  status: TrainingStatus;
  departmentId: string;
}

/** Create: the trainer is the signed-in user, the training starts as a Draft and is placed last in its department. */
export interface CreateTrainingInput {
  title: string;
  description: string;
  departmentId: string;
  startDate: string | null;
  endDate: string | null;
  durationHours: number | null;
}

export interface UpdateTrainingInput {
  title: string;
  description: string;
  status: TrainingStatus;
  startDate: string | null;
  endDate: string | null;
  durationHours: number | null;
}

export interface ReorderInput {
  orderedIds: string[];
}

/** A training in the caller's scope, for selects and filters in other modules. */
export interface TrainingOption {
  id: string;
  title: string;
  status: TrainingStatus;
  departmentId: string;
  departmentName: string | null;
}

/** One enrolled person of a training (the "Trainees" tab). */
export interface TrainingRosterEntry {
  enrollmentId: string;
  userId: string;
  userName: string;
  userRole: Role;
  status: EnrollmentStatus;
  progress: number;
  assignedAt: string;
  completedAt: string | null;
}
