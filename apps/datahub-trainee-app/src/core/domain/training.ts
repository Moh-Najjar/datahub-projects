/*
 * The training domain's vocabulary — the roles, statuses and event types of the original Training Portal, preserved
 * verbatim. It is a contract shared by the UI, the permission policy and any (mock or real) backend, so it lives in
 * core and has nothing to do with how data is stored.
 */

/** The five roles of the original Training Portal. Trainee, Intern and Employee have identical rights. */
export const ROLES = ['SuperAdmin', 'DepartmentAdmin', 'Trainee', 'Employee', 'Intern'] as const;
export type Role = (typeof ROLES)[number];

export const TRAINING_STATUSES = ['draft', 'published', 'archived'] as const;
export type TrainingStatus = (typeof TRAINING_STATUSES)[number];

export const ENROLLMENT_STATUSES = ['assigned', 'in-progress', 'completed'] as const;
export type EnrollmentStatus = (typeof ENROLLMENT_STATUSES)[number];

export const MATERIAL_TYPES = ['text', 'link', 'file'] as const;
export type MaterialType = (typeof MATERIAL_TYPES)[number];

/** Computed from the opening and closing time on every read — never stored. */
export type AssignmentStatus = 'upcoming' | 'open' | 'closed';

/** The important business events recorded on the activity timeline. */
export const ACTIVITY_TYPES = [
  'training-created',
  'training-published',
  'trainee-enrolled',
  'progress-updated',
  'enrollment-completed',
  'evaluation-submitted',
] as const;
export type ActivityType = (typeof ACTIVITY_TYPES)[number];
