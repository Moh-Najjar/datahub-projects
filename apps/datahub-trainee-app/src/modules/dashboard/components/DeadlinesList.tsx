import { useState } from 'react';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Link from '@mui/material/Link';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import AssignmentOutlinedIcon from '@mui/icons-material/AssignmentOutlined';
import EventOutlinedIcon from '@mui/icons-material/EventOutlined';
import { Link as RouterLink } from 'react-router-dom';
import { ROUTES } from '@/core/routes/paths';
import { formatDate, formatDateTime, formatRelative } from '@/i18n/format';
import { useLocale } from '@/i18n/LocaleContext';
import { useT } from '@/i18n/useT';
import type { DeadlineDto } from '../types/dashboard';

/** Upcoming deadlines: assignments about to close and trainings about to end, soonest first. */
export function DeadlinesList({ items }: { items: readonly DeadlineDto[] }) {
  const t = useT();
  const { locale } = useLocale();
  // "Now" is read once per mount so the list doesn't change under the user while it is open.
  const [now] = useState(() => Date.now());
  return (
    <Stack component="ul" spacing={1.5} sx={{ p: 0, m: 0, listStyle: 'none' }} aria-label={t.dashboard.deadlines}>
      {items.map((item) => {
        const soon = Date.parse(item.dueAt) - now < 3 * 86_400_000;
        return (
          <Stack component="li" key={item.id} direction="row" spacing={1.5} sx={{ alignItems: 'flex-start' }}>
            <Box aria-hidden sx={{ width: 32, height: 32, flexShrink: 0, borderRadius: 1, display: 'grid', placeItems: 'center', bgcolor: soon ? 'warning.light' : 'info.light', color: soon ? 'warning.main' : 'info.main' }}>
              {item.kind === 'assignment' ? <AssignmentOutlinedIcon fontSize="small" /> : <EventOutlinedIcon fontSize="small" />}
            </Box>
            <Box sx={{ minWidth: 0, flex: 1 }}>
              <Link component={RouterLink} to={ROUTES.training(item.trainingId, item.kind === 'assignment' ? 'assignments' : 'overview')} underline="hover" color="text.primary" sx={{ fontWeight: 600, display: 'block', overflowWrap: 'anywhere' }}>
                {item.title}
              </Link>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                {item.kind === 'assignment' ? `${item.trainingTitle} · ${t.dashboard.closes} ${formatDateTime(item.dueAt, locale)}` : `${t.dashboard.ends} ${formatDate(item.dueAt, locale)}`}
              </Typography>
            </Box>
            <Chip size="small" color={soon ? 'warning' : 'default'} variant="outlined" label={formatRelative(item.kind === 'training' ? `${item.dueAt}T23:59:59` : item.dueAt, locale)} />
          </Stack>
        );
      })}
    </Stack>
  );
}
