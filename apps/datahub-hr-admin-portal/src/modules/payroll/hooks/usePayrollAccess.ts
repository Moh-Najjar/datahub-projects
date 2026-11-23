import { useMemo } from 'react';
import { useAuth } from '@/core/context/authContext';
import type { PayrollScope } from '@/modules/payroll/types/payroll';

/**
 * What the signed-in role may do in Payroll (permission matrix):
 * - `hr.payroll.view` → organization payroll (runs, compensation, configuration, payslips, reports);
 * - `hr.payroll.view.own` (every role) → own compensation, payslips and payroll history only;
 * - `hr.payroll.manage` → process payroll (compensation, allowances, deductions, runs, payslips);
 * - `hr.payroll.approve` → approve or reject submitted runs (never one's own run).
 * UI only — the backend enforces the same rules and derives the scope from the signed-in user.
 */
export function usePayrollAccess() {
  const { can, user } = useAuth();
  const userId = user?.id ?? '';
  const role = user?.role ?? 'employee';
  const kind: PayrollScope['kind'] = can('hr.payroll.view') ? 'organization' : 'own';
  const scope = useMemo<PayrollScope>(() => ({ kind, userId, role }), [kind, userId, role]);
  return {
    scope,
    canReadOrganization: kind === 'organization',
    canWrite: can('hr.payroll.manage'),
    canApprove: can('hr.payroll.approve'),
  };
}
