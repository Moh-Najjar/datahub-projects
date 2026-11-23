import { useMemo } from 'react';
import { useAuth } from '@/core/context/authContext';
import type { DocumentsScope } from '@/modules/documents/types/documents';

/**
 * What the signed-in role may do in Documents (permission matrix). Reading is the UNION of:
 * - `hr.documents.view` → organization documents (highly confidential ones also need `hr.employees.view.personal`);
 * - `hr.documents.view.team` → the Department Manager's team (standard confidentiality, manager-visible categories);
 * - `hr.payroll.view` → payroll documents; `recruitment.jobs.view` → candidate documents;
 * - `hr.documents.view.own` (every role) → own documents of employee-visible categories.
 * Writes: `hr.documents.manage` (employee documents), `recruitment.jobs.manage` (candidate documents); configuration:
 * `hr.documents.config.manage`. UI only — the API enforces every rule on each request.
 */
export function useDocumentsAccess() {
  const { can, user } = useAuth();
  const userId = user?.id ?? '';
  const role = user?.role ?? 'employee';
  const scope = useMemo<DocumentsScope>(() => ({ userId, role }), [userId, role]);
  const organization = can('hr.documents.view');
  const team = can('hr.documents.view.team');
  const payroll = can('hr.payroll.view');
  const candidates = can('recruitment.jobs.view');
  return {
    scope,
    organization,
    team,
    payroll,
    candidates,
    /** Sees more than their own documents (gets the full Documents workspace). */
    beyondOwn: organization || team || payroll || candidates,
    canWrite: can('hr.documents.manage'),
    canWriteCandidates: can('recruitment.jobs.manage') || can('hr.documents.manage'),
    canConfigure: can('hr.documents.config.manage'),
    canSeeCompliance: organization || team,
  };
}
