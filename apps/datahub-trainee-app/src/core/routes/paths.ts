/** Every URL of the app (English-only: the language is a user preference, not part of the URL). Never hard-code paths. */
export const ROUTES = {
  root: '/',
  /** Public: forwards to the DataHub Workspace — there is no sign-in form. */
  login: '/login',
  /** Public: Workspace single sign-in (`/sso#token=…`). */
  sso: '/sso',
  /** Public: forwards an invitation link (`/activate?token=…`) to the website's activation page. */
  activate: '/activate',
  dashboard: '/dashboard',
  trainings: '/trainings',
  training: (id: string, tab?: 'overview' | 'content' | 'assignments' | 'trainees') => (tab && tab !== 'overview' ? `/trainings/${encodeURIComponent(id)}/${tab}` : `/trainings/${encodeURIComponent(id)}`),
  enrollments: '/enrollments',
  users: '/users',
  userEvaluations: (userId: string) => `/users/${encodeURIComponent(userId)}/evaluations`,
  departments: '/departments',
  rankings: '/rankings',
  certificates: '/certificates',
  certificate: (enrollmentId: string) => `/certificates/${encodeURIComponent(enrollmentId)}`,
} as const;

export const TRAINING_TABS = ['overview', 'content', 'assignments', 'trainees'] as const;
export type TrainingTab = (typeof TRAINING_TABS)[number];
