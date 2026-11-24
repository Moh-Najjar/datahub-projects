import type { AssignmentStatus, MaterialType } from '@/core/domain/training';

export type { AssignmentStatus, MaterialType };

/**
 * A file the user picked: its metadata (validated by both backends) and the browser `File` the real backend uploads
 * (multipart). The simulated backend records the metadata only.
 */
export interface FileInput {
  fileName: string;
  contentType: string;
  fileSizeBytes: number;
  title?: string | null;
  file?: File;
}

export interface FileItemDto {
  id: string;
  title: string | null;
  fileName: string;
  contentType: string;
  fileSizeBytes: number;
}

export interface LinkItemDto {
  id: string;
  title: string | null;
  url: string;
}

export interface MaterialDto {
  id: string;
  trainingId: string;
  type: MaterialType;
  title: string;
  sortOrder: number;
  textContent: string | null;
  files: FileItemDto[];
  links: LinkItemDto[];
  uploadedByUserName: string | null;
  createdAt: string;
}

export interface TextMaterialInput {
  title: string;
  content: string;
}

export interface LinkItemInput {
  title?: string | null;
  url: string;
}

export interface LinkMaterialInput {
  title: string;
  links: LinkItemInput[];
}

export interface FileMaterialInput {
  title: string;
  files: FileInput[];
}

export interface AssignmentSubmissionDto {
  id: string;
  assignmentId: string;
  userId: string;
  textResponse: string;
  submittedAt: string;
  updatedAt: string | null;
  attachments: FileItemDto[];
}

export interface AssignmentDto {
  id: string;
  trainingId: string;
  title: string;
  description: string;
  opensAt: string;
  closesAt: string;
  /** Computed from the opening and closing time on every read. */
  status: AssignmentStatus;
  createdByUserName: string | null;
  createdAt: string;
  attachments: FileItemDto[];
  /** Learners: their own submission (null if none). Staff: always null. */
  mySubmission: AssignmentSubmissionDto | null;
  /** Staff: how many enrolled people have submitted. */
  submissionCount: number;
  traineeCount: number;
}

export interface CreateAssignmentInput {
  title: string;
  description: string;
  opensAt: string;
  closesAt: string;
  attachments: FileInput[];
}

export interface UpdateAssignmentInput {
  title: string;
  description: string;
  opensAt: string;
  closesAt: string;
}

export interface SubmissionInput {
  textResponse: string;
  files: FileInput[];
}

export interface SubmissionOverviewEntry {
  userId: string;
  userName: string;
  submission: AssignmentSubmissionDto | null;
}
