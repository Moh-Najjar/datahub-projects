import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import AssignmentIndOutlinedIcon from '@mui/icons-material/AssignmentIndOutlined';
import CheckCircleOutlinedIcon from '@mui/icons-material/CheckCircleOutlined';
import FactCheckOutlinedIcon from '@mui/icons-material/FactCheckOutlined';
import NoteAddOutlinedIcon from '@mui/icons-material/NoteAddOutlined';
import PublishedWithChangesIcon from '@mui/icons-material/PublishedWithChanges';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import type { ReactElement } from 'react';
import { fill } from '@/i18n';
import { formatNumber, formatRelative } from '@/i18n/format';
import { useLocale } from '@/i18n/LocaleContext';
import { useT } from '@/i18n/useT';
import type { ActivityDto, ActivityType } from '../types/dashboard';

const ICONS: Record<ActivityType, ReactElement> = {
  'training-created': <NoteAddOutlinedIcon fontSize="small" />,
  'training-published': <PublishedWithChangesIcon fontSize="small" />,
  'trainee-enrolled': <AssignmentIndOutlinedIcon fontSize="small" />,
  'progress-updated': <TrendingUpIcon fontSize="small" />,
  'enrollment-completed': <CheckCircleOutlinedIcon fontSize="small" />,
  'evaluation-submitted': <FactCheckOutlinedIcon fontSize="small" />,
};

const TONES: Record<ActivityType, 'primary' | 'success' | 'info' | 'warning'> = {
  'training-created': 'info',
  'training-published': 'primary',
  'trainee-enrolled': 'info',
  'progress-updated': 'warning',
  'enrollment-completed': 'success',
  'evaluation-submitted': 'primary',
};

/** The activity timeline: who did what, to whom, and when (newest first). */
export function ActivityList({ items, dense = false }: { items: readonly ActivityDto[]; dense?: boolean }) {
  const t = useT();
  const { locale } = useLocale();
  return (
    <Stack component="ol" sx={{ p: 0, m: 0, listStyle: 'none' }} aria-label={t.activity.title}>
      {items.map((item, index) => (
        <Stack component="li" key={item.id} direction="row" spacing={1.5} sx={{ px: dense ? 2 : 0, py: 1.25, position: 'relative' }}>
          <Stack sx={{ alignItems: 'center', flexShrink: 0 }}>
            <Box aria-hidden sx={{ width: 32, height: 32, borderRadius: 1, display: 'grid', placeItems: 'center', bgcolor: (theme) => theme.palette[TONES[item.type]].light, color: (theme) => (TONES[item.type] === 'primary' ? theme.palette.primary.main : theme.palette[TONES[item.type]].main) }}>
              {ICONS[item.type]}
            </Box>
            {index < items.length - 1 && !dense && <Box aria-hidden sx={{ flex: 1, width: 2, bgcolor: 'divider', mt: 0.5, minHeight: 8 }} />}
          </Stack>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="body2" sx={{ overflowWrap: 'anywhere' }}>
              {fill(t.activity.types[item.type], { actor: item.actorName, user: item.userName ?? '', training: item.trainingTitle ?? '', progress: formatNumber(item.progress ?? 0, locale) })}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              <time dateTime={item.at}>{formatRelative(item.at, locale)}</time>
            </Typography>
          </Box>
        </Stack>
      ))}
    </Stack>
  );
}
