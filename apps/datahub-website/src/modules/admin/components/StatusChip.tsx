import Chip from '@mui/material/Chip';
import { ADMIN_TEXT } from '@/modules/admin/data/adminText';

/** Published / Draft, from the backend's status (label first; colour is only a secondary cue). */
export function StatusChip({ status }: { status: string }) {
  const published = status.toLowerCase() === 'published';
  return <Chip size="small" label={published ? ADMIN_TEXT.status.published : ADMIN_TEXT.status.draft} color={published ? 'success' : 'default'} variant={published ? 'filled' : 'outlined'} />;
}
