import Chip from '@mui/material/Chip';
import { useTranslation } from 'react-i18next';

/** Active / Inactive label (text, not colour alone, carries the meaning). */
export function StatusChip({ status }: { status: 'active' | 'inactive' }) {
  const { t } = useTranslation();
  return (
    <Chip
      size="small"
      label={t(`status.${status}`)}
      color={status === 'active' ? 'success' : 'default'}
      variant={status === 'active' ? 'filled' : 'outlined'}
      sx={{ fontWeight: 500 }}
    />
  );
}
