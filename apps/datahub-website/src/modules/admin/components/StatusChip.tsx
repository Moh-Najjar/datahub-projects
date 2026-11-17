import Chip from '@mui/material/Chip';
import type { BlogStatus } from '@/modules/blog';
import { ADMIN_TEXT } from '@/modules/admin/data/adminText';

/** Published / Draft (label first; colour is only a secondary cue). */
export function StatusChip({ status }: { status: BlogStatus }) {
  return <Chip size="small" label={ADMIN_TEXT.status[status]} color={status === 'published' ? 'success' : 'default'} variant={status === 'published' ? 'filled' : 'outlined'} sx={{ fontWeight: 500 }} />;
}
