import { useMemo } from 'react';
import { useAuth } from '@/core/context/authContext';
import type { DocumentsScope } from '@/modules/documents/types/documents';

/**
 * What the signed-in role may do in Documents (permission matrix). Reading is the UNION of:
 * - `documents:read` → organization documents (highly confidential ones also need `employees:read:personal`);
 * - `documents:read:team` → the Department Manager's team (standard confidentiality, manager-visible categories);
 * - `payroll:read` → payroll documents; `recruitment:read` → candidate documents;
 * - `documents:read:own` (every role) → own documents of employee-visible categories.
 * Writes: `documents:write` (employee documents), `recruitment:write` (candidate documents); configuration:
 * `documents:manage-config`. UI only — the API enforces every rule on each request.
 */
export function useDocumentsAccess() {
  const { can, user } = useAuth();
  const userId = user?.id ?? '';
  const role = user?.role ?? 'employee';
  const scope = useMemo<DocumentsScope>(() => ({ userId, role }), [userId, role]);
  const organization = can('documents:read');
  const team = can('documents:read:team');
  const payroll = can('payroll:read');
  const candidates = can('recruitment:read');
  return {
    scope,
    organization,
    team,
    payroll,
    candidates,
    /** Sees more than their own documents (gets the full Documents workspace). */
    beyondOwn: organization || team || payroll || candidates,
    canWrite: can('documents:write'),
    canWriteCandidates: can('recruitment:write') || can('documents:write'),
    canConfigure: can('documents:manage-config'),
    canSeeCompliance: organization || team,
  };
}
