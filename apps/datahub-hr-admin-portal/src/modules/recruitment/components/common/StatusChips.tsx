import Chip from '@mui/material/Chip';
import { useTranslation } from 'react-i18next';
import type { CandidateStage, InterviewStatus, OfferStatus, RequisitionStatus } from '@/modules/recruitment/types/recruitment';
import { INTERVIEW_TONE, OFFER_TONE, REQUISITION_TONE, STAGE_TONE } from '@/modules/recruitment/utils/format';

/* Status chips: translated label; colour is only a secondary cue. */

const sx = { fontWeight: 500 } as const;

export function StageChip({ stage }: { stage: CandidateStage }) {
  const { t } = useTranslation('recruitment');
  return <Chip size="small" label={t(`stages.${stage}`)} color={STAGE_TONE[stage]} variant={stage === 'hired' || stage === 'rejected' ? 'filled' : 'outlined'} sx={sx} data-stage={stage} />;
}

export function RequisitionStatusChip({ status }: { status: RequisitionStatus }) {
  const { t } = useTranslation('recruitment');
  return <Chip size="small" label={t(`requisitionStatus.${status}`)} color={REQUISITION_TONE[status]} variant={status === 'open' ? 'filled' : 'outlined'} sx={sx} data-status={status} />;
}

export function InterviewStatusChip({ status }: { status: InterviewStatus }) {
  const { t } = useTranslation('recruitment');
  return <Chip size="small" label={t(`interviewStatus.${status}`)} color={INTERVIEW_TONE[status]} variant="outlined" sx={sx} data-status={status} />;
}

export function OfferStatusChip({ status }: { status: OfferStatus }) {
  const { t } = useTranslation('recruitment');
  return <Chip size="small" label={t(`offerStatus.${status}`)} color={OFFER_TONE[status]} variant={status === 'accepted' ? 'filled' : 'outlined'} sx={sx} data-status={status} />;
}
