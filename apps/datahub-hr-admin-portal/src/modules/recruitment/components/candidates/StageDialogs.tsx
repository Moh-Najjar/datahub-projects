import { useState } from 'react';
import Alert from '@mui/material/Alert';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '@/i18n/useLanguage';
import { ConfirmDialog } from '@/modules/shared/ConfirmDialog';
import { FormDialog } from '@/modules/shared/FormDialog';
import { useArchiveCandidate, useReopenCandidate, useUpdateCandidateStage } from '@/modules/recruitment/hooks/useRecruitment';
import type { Candidate, CandidateStage } from '@/modules/recruitment/types/recruitment';
import { personName } from '@/modules/recruitment/utils/format';
import { errorText } from '@/modules/recruitment/utils/serverErrors';

/**
 * Moves a candidate to one of the stages the API allows now (`candidate.nextStages`), or — for a rejected candidate —
 * reopens them (explicit operation). The note is recorded in the candidate's history.
 */
export function StageDialog({ candidate, mode, initialStage, onClose, onDone }: { candidate: Candidate; mode: 'move' | 'reopen'; initialStage?: CandidateStage; onClose: () => void; onDone: (c: Candidate) => void }) {
  const { t } = useTranslation('recruitment');
  const { t: tCommon } = useTranslation();
  const { language } = useLanguage();
  const move = useUpdateCandidateStage();
  const reopen = useReopenCandidate();
  const mutation = mode === 'move' ? move : reopen;
  const [stage, setStage] = useState<CandidateStage | ''>(initialStage ?? candidate.nextStages[0] ?? '');
  const [note, setNote] = useState('');
  const name = personName(candidate.name, language);
  return (
    <FormDialog
      open
      title={mode === 'move' ? t('pipeline.moveTitle', { name }) : t('pipeline.reopenTitle', { name })}
      onClose={onClose}
      onSubmit={(e) => {
        e.preventDefault();
        if (mode === 'move' && stage) move.mutate({ id: candidate.id, stage, note }, { onSuccess: onDone });
        if (mode === 'reopen') reopen.mutate({ id: candidate.id, note }, { onSuccess: onDone });
      }}
      submitLabel={mode === 'move' ? t('actions.move') : t('actions.reopen')}
      pending={mutation.isPending}
      error={mutation.isError ? errorText(t, tCommon, mutation.error) : undefined}
    >
      {mode === 'move' ? (
        <TextField select label={t('pipeline.toStage')} value={stage} onChange={(e) => setStage(e.target.value as CandidateStage)} helperText={t('pipeline.currentStage', { stage: t(`stages.${candidate.stage}`) })}>
          {candidate.nextStages.map((s) => (
            <MenuItem key={s} value={s}>
              {t(`stages.${s}`)}
            </MenuItem>
          ))}
        </TextField>
      ) : (
        <Alert severity="info">{t('pipeline.reopenHint')}</Alert>
      )}
      {mode === 'move' && stage === 'rejected' && <Alert severity="warning">{t('pipeline.rejectHint')}</Alert>}
      <TextField label={t('fields.note')} multiline minRows={2} value={note} onChange={(e) => setNote(e.target.value)} slotProps={{ htmlInput: { maxLength: 300 } }} />
    </FormDialog>
  );
}

/** Archive confirmation (refused by the API while interviews are scheduled or an offer is open). */
export function ArchiveDialog({ candidate, onClose, onDone }: { candidate: Candidate; onClose: () => void; onDone: (c: Candidate) => void }) {
  const { t } = useTranslation('recruitment');
  const { t: tCommon } = useTranslation();
  const { language } = useLanguage();
  const archive = useArchiveCandidate();
  return (
    <ConfirmDialog
      open
      title={t('candidates.archiveTitle', { name: personName(candidate.name, language) })}
      text={t('candidates.archiveText')}
      confirmLabel={t('actions.archive')}
      pending={archive.isPending}
      error={archive.isError ? errorText(t, tCommon, archive.error) : undefined}
      onConfirm={() => archive.mutate(candidate.id, { onSuccess: onDone })}
      onClose={onClose}
    />
  );
}
