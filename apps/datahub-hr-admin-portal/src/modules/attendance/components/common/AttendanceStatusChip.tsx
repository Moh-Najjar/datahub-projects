import Chip from '@mui/material/Chip';
import Tooltip from '@mui/material/Tooltip';
import { useTranslation } from 'react-i18next';
import type { AttendanceStatus } from '@/modules/attendance/types/attendance';
import { STATUS_TONE } from '@/modules/attendance/utils/format';

/** Attendance status: translated label (colour is a secondary cue), with an explanation for the less obvious ones. */
export function AttendanceStatusChip({ status }: { status: AttendanceStatus }) {
  const { t } = useTranslation('attendance');
  const tone = STATUS_TONE[status];
  const chip = (
    <Chip
      size="small"
      label={t(`status.${status}`)}
      color={tone}
      variant={status === 'present' || status === 'absent' || status === 'late' ? 'filled' : 'outlined'}
      sx={{ fontWeight: 500 }}
      data-status={status}
    />
  );
  return status === 'scheduled' || status === 'incomplete' ? <Tooltip title={t(`statusHint.${status}`)}>{chip}</Tooltip> : chip;
}
