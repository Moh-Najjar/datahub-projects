import Chip from '@mui/material/Chip';
import { useTranslation } from 'react-i18next';
import type { LeaveStatus } from '@/modules/leave/types/leave';
import { STATUS_TONE } from '@/modules/leave/utils/format';

/** Request status: translated label (colour is a secondary cue). */
export function LeaveStatusChip({ status }: { status: LeaveStatus }) {
  const { t } = useTranslation('leave');
  return (
    <Chip
      size="small"
      label={t(`status.${status}`)}
      color={STATUS_TONE[status]}
      variant={status === 'approved' || status === 'rejected' ? 'filled' : 'outlined'}
      sx={{ fontWeight: 500, ...(status === 'cancelled' && { textDecoration: 'line-through' }) }}
      data-status={status}
    />
  );
}
