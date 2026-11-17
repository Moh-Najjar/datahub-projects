import { useState } from 'react';
import CancelOutlined from '@mui/icons-material/CancelOutlined';
import EditOutlined from '@mui/icons-material/EditOutlined';
import RateReviewOutlined from '@mui/icons-material/RateReviewOutlined';
import TaskAltOutlined from '@mui/icons-material/TaskAltOutlined';
import VisibilityOutlined from '@mui/icons-material/VisibilityOutlined';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '@/i18n/useLanguage';
import { ConfirmDialog } from '@/modules/shared/ConfirmDialog';
import type { RowAction } from '@/modules/shared/RowActions';
import { useUpdateInterviewStatus } from '@/modules/recruitment/hooks/useRecruitment';
import { recruitmentPaths } from '@/modules/recruitment/paths';
import type { Interview } from '@/modules/recruitment/types/recruitment';
import { errorText } from '@/modules/recruitment/utils/serverErrors';
import { CancelInterviewDialog, FeedbackDialog } from './InterviewDialogs';
import { InterviewFormDialog } from './InterviewFormDialog';

type Pending = { kind: 'edit' | 'cancel' | 'complete' | 'no-show'; interview: Interview } | { kind: 'feedback'; interview: Interview; interviewerId: string } | null;

/** Interview actions offered only when the API allows them (`interview.can`). */
export function useInterviewActions(notify: (text: string, severity?: 'success' | 'error') => void, options: { includeView?: boolean } = {}) {
  const { t } = useTranslation('recruitment');
  const { t: tCommon } = useTranslation();
  const { language } = useLanguage();
  const status = useUpdateInterviewStatus();
  const [pending, setPending] = useState<Pending>(null);
  const close = () => setPending(null);
  const open = (p: NonNullable<Pending>) => {
    status.reset();
    setPending(p);
  };

  const actionsFor = (i: Interview): RowAction[] => [
    ...(options.includeView === false ? [] : [{ label: t('actions.viewDetails'), icon: VisibilityOutlined, to: recruitmentPaths.interview(i.id) }]),
    ...i.can.feedbackFor.map((id) => ({
      label: i.can.feedbackFor.length > 1 ? t('actions.feedbackFor', { name: i.interviewers.find((p) => p.id === id)?.name[language] ?? '' }) : t('actions.submitFeedback'),
      icon: RateReviewOutlined,
      onClick: () => open({ kind: 'feedback', interview: i, interviewerId: id }),
    })),
    ...(i.can.edit ? [{ label: t('actions.reschedule'), icon: EditOutlined, onClick: () => open({ kind: 'edit', interview: i }) }] : []),
    ...(i.can.complete ? [{ label: t('actions.markCompleted'), icon: TaskAltOutlined, onClick: () => open({ kind: 'complete', interview: i }) }] : []),
    ...(i.can.complete ? [{ label: t('actions.markNoShow'), icon: CancelOutlined, onClick: () => open({ kind: 'no-show', interview: i }) }] : []),
    ...(i.can.cancel ? [{ label: t('actions.cancelInterview'), icon: CancelOutlined, onClick: () => open({ kind: 'cancel', interview: i }) }] : []),
  ];

  const dialogs = pending && (
    <>
      {pending.kind === 'edit' && (
        <InterviewFormDialog
          interview={pending.interview}
          onClose={close}
          onDone={() => {
            close();
            notify(t('interviews.updated'));
          }}
        />
      )}
      {pending.kind === 'cancel' && (
        <CancelInterviewDialog
          interview={pending.interview}
          onClose={close}
          onDone={() => {
            close();
            notify(t('interviews.cancelled'));
          }}
        />
      )}
      {pending.kind === 'feedback' && (
        <FeedbackDialog
          interview={pending.interview}
          interviewerId={pending.interviewerId}
          onClose={close}
          onDone={() => {
            close();
            notify(t('feedback.submitted'));
          }}
        />
      )}
      {(pending.kind === 'complete' || pending.kind === 'no-show') && (
        <ConfirmDialog
          open
          title={t(pending.kind === 'complete' ? 'interviews.completeTitle' : 'interviews.noShowTitle')}
          text={t(pending.kind === 'complete' ? 'interviews.completeText' : 'interviews.noShowText')}
          confirmLabel={t(pending.kind === 'complete' ? 'actions.markCompleted' : 'actions.markNoShow')}
          pending={status.isPending}
          error={status.isError ? errorText(t, tCommon, status.error) : undefined}
          onConfirm={() =>
            status.mutate(
              { id: pending.interview.id, status: pending.kind === 'complete' ? 'completed' : 'no-show' },
              {
                onSuccess: () => {
                  close();
                  notify(t('interviews.updated'));
                },
              },
            )
          }
          onClose={close}
        />
      )}
    </>
  );

  return { actionsFor, dialogs };
}
