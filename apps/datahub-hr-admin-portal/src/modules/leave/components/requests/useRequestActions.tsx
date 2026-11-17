import { useState } from 'react';
import CancelOutlined from '@mui/icons-material/CancelOutlined';
import CheckCircleOutlined from '@mui/icons-material/CheckCircleOutlined';
import DoNotDisturbOnOutlined from '@mui/icons-material/DoNotDisturbOnOutlined';
import EditOutlined from '@mui/icons-material/EditOutlined';
import VisibilityOutlined from '@mui/icons-material/VisibilityOutlined';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '@/i18n/useLanguage';
import { ConfirmDialog } from '@/modules/shared/ConfirmDialog';
import type { RowAction } from '@/modules/shared/RowActions';
import { useApproveLeaveRequest, useCancelLeaveRequest } from '@/modules/leave/hooks/useLeave';
import { leavePaths } from '@/modules/leave/paths';
import type { LeaveRequest } from '@/modules/leave/types/leave';
import { formatDays } from '@/modules/leave/utils/format';
import { errorText } from '@/modules/leave/utils/serverErrors';
import { RejectDialog } from './RejectDialog';
import { RequestFormDialog } from './RequestFormDialog';

type Pending = { kind: 'approve' | 'reject' | 'cancel' | 'edit'; request: LeaveRequest } | null;

/**
 * Actions on a request — offered only when the API says so (`request.can`, computed by the backend from the rules and
 * the caller's permissions); the API re-checks everything when the action is sent.
 */
export function useRequestActions(notify: (text: string, severity?: 'success' | 'error') => void, options: { includeView?: boolean } = {}) {
  const { t } = useTranslation('leave');
  const { t: tCommon } = useTranslation();
  const { language } = useLanguage();
  const approve = useApproveLeaveRequest();
  const cancel = useCancelLeaveRequest();
  const [pending, setPending] = useState<Pending>(null);

  const open = (kind: NonNullable<Pending>['kind'], request: LeaveRequest) => {
    approve.reset();
    cancel.reset();
    setPending({ kind, request });
  };

  const actionsFor = (r: LeaveRequest): RowAction[] => [
    ...(options.includeView === false ? [] : [{ label: t('actions.viewDetails'), icon: VisibilityOutlined, to: leavePaths.request(r.id) }]),
    ...(r.can.approve ? [{ label: t('actions.approve'), icon: CheckCircleOutlined, onClick: () => open('approve', r) }] : []),
    ...(r.can.approve ? [{ label: t('actions.reject'), icon: DoNotDisturbOnOutlined, onClick: () => open('reject', r) }] : []),
    ...(r.can.edit ? [{ label: t('actions.edit'), icon: EditOutlined, onClick: () => open('edit', r) }] : []),
    ...(r.can.cancel ? [{ label: t('actions.cancelRequest'), icon: CancelOutlined, onClick: () => open('cancel', r) }] : []),
  ];

  const close = () => setPending(null);
  const dialogs = (
    <>
      <ConfirmDialog
        open={pending?.kind === 'approve'}
        title={pending ? t('decide.approveTitle', { number: pending.request.number }) : ''}
        text={pending ? t('decide.approveText', { name: pending.request.employee.name[language], days: formatDays(t, pending.request.days, language) }) : ''}
        confirmLabel={t('actions.approve')}
        pending={approve.isPending}
        error={approve.isError ? errorText(t, tCommon, approve.error) : undefined}
        onConfirm={() =>
          pending &&
          approve.mutate(pending.request.id, {
            onSuccess: (r) => {
              close();
              notify(t('decide.approved', { number: r.number }));
            },
          })
        }
        onClose={close}
      />
      <ConfirmDialog
        open={pending?.kind === 'cancel'}
        title={pending ? t('decide.cancelTitle', { number: pending.request.number }) : ''}
        text={pending ? t(pending.request.status === 'approved' ? 'decide.cancelApprovedText' : 'decide.cancelText') : ''}
        confirmLabel={t('actions.cancelRequest')}
        pending={cancel.isPending}
        error={cancel.isError ? errorText(t, tCommon, cancel.error) : undefined}
        onConfirm={() =>
          pending &&
          cancel.mutate(pending.request.id, {
            onSuccess: (r) => {
              close();
              notify(t('decide.cancelled', { number: r.number }));
            },
          })
        }
        onClose={close}
      />
      {pending?.kind === 'reject' && (
        <RejectDialog
          request={pending.request}
          onClose={close}
          onDone={(r) => {
            close();
            notify(t('decide.rejected', { number: r.number }));
          }}
        />
      )}
      {pending?.kind === 'edit' && (
        <RequestFormDialog
          request={pending.request}
          onClose={close}
          onDone={(r, submitted) => {
            close();
            notify(t(submitted ? 'form.submitted' : 'form.draftSaved', { number: r.number }));
          }}
        />
      )}
    </>
  );

  return { actionsFor, open, dialogs };
}
