import Chip from '@mui/material/Chip';
import { useTranslation } from 'react-i18next';
import type { AssignmentState, CompensationStatus, LineStatus, RecordState, RunStatus } from '@/modules/payroll/types/payroll';
import { COMP_TONE, LINE_TONE, RUN_TONE, STATE_TONE } from '@/modules/payroll/utils/format';

export function RunStatusChip({ status }: { status: RunStatus }) {
  const { t } = useTranslation('payroll');
  return <Chip size="small" color={RUN_TONE[status]} variant={status === 'paid' || status === 'approved' ? 'filled' : 'outlined'} label={t(`runStatus.${status}`)} />;
}

export function LineStatusChip({ status }: { status: LineStatus }) {
  const { t } = useTranslation('payroll');
  return <Chip size="small" color={LINE_TONE[status]} variant="outlined" label={t(`lineStatus.${status}`)} />;
}

export function CompensationStatusChip({ status }: { status: CompensationStatus }) {
  const { t } = useTranslation('payroll');
  return <Chip size="small" color={COMP_TONE[status]} variant="outlined" label={t(`compensationStatus.${status}`)} />;
}

export function StateChip({ state }: { state: RecordState | AssignmentState }) {
  const { t } = useTranslation('payroll');
  return <Chip size="small" color={STATE_TONE[state]} variant="outlined" label={t(`recordState.${state}`)} />;
}

/** Marks illustrative (non-legal) configuration or results. */
export function IllustrativeChip() {
  const { t } = useTranslation('payroll');
  return <Chip size="small" color="warning" variant="outlined" label={t('common.illustrative')} />;
}
