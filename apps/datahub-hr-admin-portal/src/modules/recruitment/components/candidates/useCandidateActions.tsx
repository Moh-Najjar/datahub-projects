import { useState } from 'react';
import ArchiveOutlined from '@mui/icons-material/ArchiveOutlined';
import BadgeOutlined from '@mui/icons-material/BadgeOutlined';
import EditOutlined from '@mui/icons-material/EditOutlined';
import EventOutlined from '@mui/icons-material/EventOutlined';
import LocalOfferOutlined from '@mui/icons-material/LocalOfferOutlined';
import RestartAltOutlined from '@mui/icons-material/RestartAltOutlined';
import SyncAltOutlined from '@mui/icons-material/SyncAltOutlined';
import VisibilityOutlined from '@mui/icons-material/VisibilityOutlined';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '@/i18n/useLanguage';
import type { RowAction } from '@/modules/shared/RowActions';
import { recruitmentPaths } from '@/modules/recruitment/paths';
import type { Candidate, CandidateStage } from '@/modules/recruitment/types/recruitment';
import { personName } from '@/modules/recruitment/utils/format';
import { InterviewFormDialog } from '../interviews/InterviewFormDialog';
import { OfferFormDialog } from '../offers/OfferFormDialog';
import { CandidateFormDialog } from './CandidateFormDialog';
import { ArchiveDialog, StageDialog } from './StageDialogs';

type Pending = { kind: 'edit' | 'move' | 'reopen' | 'archive' | 'interview' | 'offer'; candidate: Candidate; stage?: CandidateStage } | null;

/** Candidate actions offered only when the API allows them (`candidate.can`, `candidate.nextStages`). */
export function useCandidateActions(notify: (text: string, severity?: 'success' | 'error') => void, options: { includeView?: boolean } = {}) {
  const { t } = useTranslation('recruitment');
  const { language } = useLanguage();
  const [pending, setPending] = useState<Pending>(null);
  const open = (kind: NonNullable<Pending>['kind'], candidate: Candidate, stage?: CandidateStage) => setPending({ kind, candidate, stage });
  const close = () => setPending(null);

  const actionsFor = (c: Candidate): RowAction[] => [
    ...(options.includeView === false ? [] : [{ label: t('actions.viewProfile'), icon: VisibilityOutlined, to: recruitmentPaths.candidate(c.id) }]),
    ...(c.nextStages.length ? [{ label: t('actions.moveStage'), icon: SyncAltOutlined, onClick: () => open('move', c) }] : []),
    ...(c.can.reopen ? [{ label: t('actions.reopen'), icon: RestartAltOutlined, onClick: () => open('reopen', c) }] : []),
    ...(c.can.schedule ? [{ label: t('actions.scheduleInterview'), icon: EventOutlined, onClick: () => open('interview', c) }] : []),
    ...(c.can.offer ? [{ label: t('actions.prepareOffer'), icon: LocalOfferOutlined, onClick: () => open('offer', c) }] : []),
    ...(c.can.convert ? [{ label: t('actions.convert'), icon: BadgeOutlined, to: recruitmentPaths.convert(c.id) }] : []),
    ...(c.can.edit ? [{ label: t('actions.edit'), icon: EditOutlined, onClick: () => open('edit', c) }] : []),
    ...(c.can.archive ? [{ label: t('actions.archive'), icon: ArchiveOutlined, onClick: () => open('archive', c) }] : []),
  ];

  const dialogs = pending && (
    <>
      {pending.kind === 'edit' && (
        <CandidateFormDialog
          candidate={pending.candidate}
          onClose={close}
          onDone={(c) => {
            close();
            notify(t('candidates.saved', { name: personName(c.name, language) }));
          }}
        />
      )}
      {(pending.kind === 'move' || pending.kind === 'reopen') && (
        <StageDialog
          candidate={pending.candidate}
          mode={pending.kind}
          initialStage={pending.stage}
          onClose={close}
          onDone={(c) => {
            close();
            notify(t('pipeline.moved', { name: personName(c.name, language), stage: t(`stages.${c.stage}`) }));
          }}
        />
      )}
      {pending.kind === 'archive' && (
        <ArchiveDialog
          candidate={pending.candidate}
          onClose={close}
          onDone={(c) => {
            close();
            notify(t('candidates.archived', { name: personName(c.name, language) }));
          }}
        />
      )}
      {pending.kind === 'interview' && (
        <InterviewFormDialog
          candidate={pending.candidate}
          onClose={close}
          onDone={() => {
            close();
            notify(t('interviews.scheduled'));
          }}
        />
      )}
      {pending.kind === 'offer' && (
        <OfferFormDialog
          candidate={pending.candidate}
          onClose={close}
          onDone={(o) => {
            close();
            notify(t('offers.created', { number: o.number }));
          }}
        />
      )}
    </>
  );

  return { actionsFor, open, dialogs };
}
