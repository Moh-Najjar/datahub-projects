import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/core/context/authContext';
import { attendanceApi } from '@/modules/attendance';
import { documentsApi } from '@/modules/documents';
import { leaveApi } from '@/modules/leave';
import { organizationApi } from '@/modules/organization';
import { payrollApi } from '@/modules/payroll';
import { performanceApi } from '@/modules/performance';

/*
 * The configuration each module already owns, read through ITS OWN API service (never copied into settings) for the
 * read-only summaries of System Settings. Every query runs in the caller's scope and only when the caller may read
 * that module; the module's own keys are reused so its pages and these summaries share the cache.
 */

const ALL = { page: 1, pageSize: 100 } as const;

function useScope() {
  const { user, can } = useAuth();
  const userId = user?.id ?? '';
  const role = user?.role ?? 'employee';
  return { userId, role, can };
}

export function useOrganizationFacts() {
  const { can } = useScope();
  return useQuery({ queryKey: ['organization', 'summary', 'settings'], queryFn: ({ signal }) => organizationApi.getOrganizationSummary(signal), enabled: can('organization.departments.view') });
}

export function useShiftFacts() {
  const { userId, role, can } = useScope();
  return useQuery({
    queryKey: ['attendance', 'shifts', 'settings', userId, role],
    queryFn: ({ signal }) => attendanceApi.getShifts(ALL, { kind: 'organization', userId, role }, signal),
    enabled: can('hr.attendance.view'),
  });
}

export function useLeaveTypeFacts() {
  const { userId, role, can } = useScope();
  return useQuery({
    queryKey: ['leave', 'types', 'settings', userId, role],
    queryFn: ({ signal }) => leaveApi.getLeaveTypes({ ...ALL, sortBy: 'code', sortDirection: 'asc' }, { kind: 'organization', userId, role }, signal),
    enabled: can('hr.leave.view'),
  });
}

export function usePerformanceFacts() {
  const { userId, role, can } = useScope();
  const scope = { kind: 'organization' as const, userId, role };
  const enabled = can('hr.performance.view');
  const scale = useQuery({ queryKey: ['performance', 'scale', 'settings', userId, role], queryFn: ({ signal }) => performanceApi.getRatingScale(scope, signal), enabled });
  const cycles = useQuery({ queryKey: ['performance', 'cycles', 'settings', userId, role], queryFn: ({ signal }) => performanceApi.getReviewCycles(ALL, scope, signal), enabled });
  return { scale, cycles };
}

export function usePayrollFacts() {
  const { userId, role, can } = useScope();
  return useQuery({
    queryKey: ['payroll', 'policy', 'settings', userId, role],
    queryFn: ({ signal }) => payrollApi.getPayrollPolicy({ kind: 'organization', userId, role }, signal),
    enabled: can('hr.payroll.view'),
  });
}

export function useDocumentFacts() {
  const { userId, role, can } = useScope();
  const scope = { userId, role };
  const enabled = can('hr.documents.view');
  const settings = useQuery({ queryKey: ['documents', 'settings', 'settings-page', userId, role], queryFn: ({ signal }) => documentsApi.getDocumentSettings(scope, signal), enabled });
  const categories = useQuery({ queryKey: ['documents', 'categories', 'settings-page', userId, role], queryFn: ({ signal }) => documentsApi.getDocumentCategories(ALL, scope, signal), enabled });
  const rules = useQuery({ queryKey: ['documents', 'rules', 'settings-page', userId, role], queryFn: ({ signal }) => documentsApi.getRequiredDocuments(scope, signal), enabled });
  return { settings, categories, rules };
}
