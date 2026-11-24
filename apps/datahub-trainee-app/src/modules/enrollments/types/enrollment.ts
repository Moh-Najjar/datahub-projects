import type { EnrollmentStatus, Role } from '@/core/domain/training';

export type { EnrollmentStatus };

export interface EnrollmentDto {
  id: string;
  trainingId: string;
  trainingTitle: string;
  departmentId: string;
  departmentName: string | null;
  userId: string;
  userName: string;
  userRole: Role;
  assignedByUserId: string;
  assignedByUserName: string | null;
  status: EnrollmentStatus;
  /** 0–100; 100 ⇔ Completed. */
  progress: number;
  assignedAt: string;
  completedAt: string | null;
}

export interface EnrollmentFilters {
  trainingId: string;
  userId: string;
  status: EnrollmentStatus;
}

export interface CreateEnrollmentInput {
  trainingId: string;
  userId: string;
}

export interface UpdateEnrollmentStatusInput {
  status: EnrollmentStatus;
}

export interface UpdateEnrollmentProgressInput {
  /** 0–100. */
  progress: number;
}
