import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import LinearProgress from '@mui/material/LinearProgress';
import Typography from '@mui/material/Typography';
import { useTranslation } from 'react-i18next';
import { formatNumber } from '@/i18n/format';
import { useLanguage } from '@/i18n/useLanguage';
import type { CycleStatus, GoalStatus, PlanStatus, ReviewState } from '@/modules/performance/types/performance';
import { CYCLE_TONE, GOAL_TONE, PLAN_TONE, REVIEW_TONE } from '@/modules/performance/utils/format';

/* Status chips (translated label; colour is a secondary cue) and a labelled progress bar. */

const sx = { fontWeight: 500 } as const;

export function CycleStatusChip({ status }: { status: CycleStatus }) {
  const { t } = useTranslation('performance');
  return <Chip size="small" label={t(`cycleStatus.${status}`)} color={CYCLE_TONE[status]} variant={status === 'completed' ? 'filled' : 'outlined'} sx={sx} data-status={status} />;
}

export function GoalStatusChip({ status }: { status: GoalStatus }) {
  const { t } = useTranslation('performance');
  return <Chip size="small" label={t(`goalStatus.${status}`)} color={GOAL_TONE[status]} variant={status === 'completed' ? 'filled' : 'outlined'} sx={sx} data-status={status} />;
}

export function ReviewStateChip({ state }: { state: ReviewState }) {
  const { t } = useTranslation('performance');
  return <Chip size="small" label={t(`reviewState.${state}`)} color={REVIEW_TONE[state]} variant={state === 'completed' ? 'filled' : 'outlined'} sx={sx} data-state={state} />;
}

export function PlanStatusChip({ status }: { status: PlanStatus }) {
  const { t } = useTranslation('performance');
  return <Chip size="small" label={t(`planStatus.${status}`)} color={PLAN_TONE[status]} variant={status === 'completed' ? 'filled' : 'outlined'} sx={sx} data-status={status} />;
}

/** Progress 0–100 with its value as text (the bar is decorative next to the number). */
export function ProgressBar({ value, label }: { value: number; label: string }) {
  const { language } = useLanguage();
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 110 }}>
      <LinearProgress variant="determinate" value={value} aria-label={label} sx={{ flex: 1, height: 6, borderRadius: 3 }} />
      <Typography variant="caption" sx={{ minWidth: 34, textAlign: 'end' }}>
        {formatNumber(value / 100, language, { style: 'percent' })}
      </Typography>
    </Box>
  );
}
