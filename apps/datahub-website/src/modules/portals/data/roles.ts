/** Backend roles this site has a label for (`workspace.roles` in i18n/locales). Other roles are shown by name. */
export const WORKSPACE_ROLES = ['system-admin', 'hr-admin', 'hr-manager', 'department-manager', 'employee', 'recruiter', 'payroll-officer', 'blogs-admin'] as const;

export type WorkspaceRole = (typeof WORKSPACE_ROLES)[number];

export const isWorkspaceRole = (value: string): value is WorkspaceRole => (WORKSPACE_ROLES as readonly string[]).includes(value);
