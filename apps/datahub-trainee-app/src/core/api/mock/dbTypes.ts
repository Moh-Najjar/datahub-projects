/*
 * Records of the SIMULATED training backend. They mirror the original Training Portal's entities (statuses, roles and
 * relations preserved) and are the only thing the mock layer stores. Request/response contracts live in each
 * module's `types/` and do not depend on these records.
 */

import type { ActivityType, EnrollmentStatus, MaterialType, Role, TrainingStatus } from '@/core/domain/training';

export { ACTIVITY_TYPES, ENROLLMENT_STATUSES, MATERIAL_TYPES, ROLES, TRAINING_STATUSES } from '@/core/domain/training';
export type { ActivityType, AssignmentStatus, EnrollmentStatus, MaterialType, Role, TrainingStatus } from '@/core/domain/training';

export interface DbDepartment {
  id: string;
  name: string;
  createdAt: string;
}

export interface DbUser {
  id: string;
  fullName: string;
  email: string;
  role: Role;
  isActive: boolean;
  departmentId: string | null;
  createdAt: string;
}

export interface DbTraining {
  id: string;
  title: string;
  description: string;
  status: TrainingStatus;
  sortOrder: number;
  departmentId: string;
  trainerId: string | null;
  /** ISO dates (`yyyy-MM-dd`), optional additions. */
  startDate: string | null;
  endDate: string | null;
  durationHours: number | null;
  createdAt: string;
  updatedAt: string | null;
}

/** A file that was "uploaded": only its metadata is kept (the mock stores no bytes). */
export interface DbFile {
  id: string;
  title: string | null;
  fileName: string;
  contentType: string;
  fileSizeBytes: number;
}

export interface DbLink {
  id: string;
  title: string | null;
  url: string;
}

export interface DbMaterial {
  id: string;
  trainingId: string;
  type: MaterialType;
  title: string;
  sortOrder: number;
  textContent: string | null;
  files: DbFile[];
  links: DbLink[];
  uploadedByUserId: string;
  createdAt: string;
}

export interface DbAssignment {
  id: string;
  trainingId: string;
  title: string;
  description: string;
  opensAt: string;
  closesAt: string;
  createdByUserId: string;
  createdAt: string;
  attachments: DbFile[];
}

export interface DbSubmission {
  id: string;
  assignmentId: string;
  userId: string;
  textResponse: string;
  submittedAt: string;
  updatedAt: string | null;
  attachments: DbFile[];
}

export interface DbEnrollment {
  id: string;
  trainingId: string;
  userId: string;
  assignedByUserId: string;
  status: EnrollmentStatus;
  /** 0–100. 100 ⇔ Completed. */
  progress: number;
  assignedAt: string;
  completedAt: string | null;
}

export interface DbEvaluationCategory {
  id: string;
  categoryName: string;
  criteria: string;
  /** 1–10. */
  score: number;
}

export interface DbEvaluation {
  id: string;
  userId: string;
  evaluatedByUserId: string;
  enrollmentId: string | null;
  evaluatedAt: string;
  createdAt: string;
  updatedAt: string | null;
  categories: DbEvaluationCategory[];
}

export interface DbActivity {
  id: string;
  type: ActivityType;
  at: string;
  actorId: string;
  actorName: string;
  trainingId: string | null;
  trainingTitle: string | null;
  departmentId: string | null;
  /** The trainee the event is about, when there is one. */
  userId: string | null;
  userName: string | null;
  /** Progress percentage for `progress-updated`. */
  progress: number | null;
}

export interface MockDatabase {
  departments: DbDepartment[];
  users: DbUser[];
  trainings: DbTraining[];
  materials: DbMaterial[];
  assignments: DbAssignment[];
  submissions: DbSubmission[];
  enrollments: DbEnrollment[];
  evaluations: DbEvaluation[];
  activities: DbActivity[];
  /** Counter behind `newId`. */
  seq: number;
}
