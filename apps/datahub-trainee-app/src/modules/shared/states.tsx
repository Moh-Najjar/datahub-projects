import type { ReactNode } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import ErrorOutlinedIcon from '@mui/icons-material/ErrorOutlined';
import InboxOutlinedIcon from '@mui/icons-material/InboxOutlined';
import { apiErrorMessage } from '@/modules/shared/utils/apiMessage';
import { useT } from '@/i18n/useT';

interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: ReactNode;
  action?: ReactNode;
  /** Compact (inside a card/table) or roomy (a whole page area). */
  dense?: boolean;
}

/** Nothing to show yet (no records, or no records match the filters). */
export function EmptyState({ title, description, icon, action, dense = false }: EmptyStateProps) {
  return (
    <Stack spacing={1.25} sx={{ alignItems: "center", textAlign: "center", py: dense ? 5 : 8, px: 2 }}>
      <Box aria-hidden sx={{ width: 56, height: 56, borderRadius: 1, display: 'grid', placeItems: 'center', bgcolor: 'primary.light', color: 'primary.main' }}>
        {icon ?? <InboxOutlinedIcon />}
      </Box>
      <Typography variant="h6" component="p">
        {title}
      </Typography>
      {description && (
        <Typography color="text.secondary" sx={{ maxWidth: 440 }}>
          {description}
        </Typography>
      )}
      {action && <Box sx={{ pt: 1 }}>{action}</Box>}
    </Stack>
  );
}

/** A spinner with an accessible label, for areas that load as a whole. */
export function LoadingState({ label, minHeight = 240 }: { label?: string; minHeight?: number }) {
  const t = useT();
  return (
    <Stack role="status" spacing={1.5} sx={{ alignItems: 'center', justifyContent: 'center', minHeight, py: 4 }}>
      <CircularProgress size={28} />
      <Typography color="text.secondary">{label ?? t.common.loading}</Typography>
    </Stack>
  );
}

/** Skeleton lines for cards and detail blocks. */
export function SkeletonBlock({ lines = 3, height = 22 }: { lines?: number; height?: number }) {
  return (
    <Stack spacing={1} aria-hidden>
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} variant="rounded" height={height} width={i === lines - 1 ? '60%' : '100%'} />
      ))}
    </Stack>
  );
}

/** A failed request: the translated reason and a Retry button. */
export function ErrorState({ error, onRetry, dense = false }: { error: unknown; onRetry?: () => void; dense?: boolean }) {
  const t = useT();
  return (
    <Stack role="alert" spacing={1.25} sx={{ alignItems: "center", textAlign: "center", py: dense ? 5 : 8, px: 2 }}>
      <Box aria-hidden sx={{ width: 56, height: 56, borderRadius: 1, display: 'grid', placeItems: 'center', bgcolor: 'error.light', color: 'error.main' }}>
        <ErrorOutlinedIcon />
      </Box>
      <Typography variant="h6" component="p">
        {t.errors.loadFailedTitle}
      </Typography>
      <Typography color="text.secondary" sx={{ maxWidth: 440 }}>
        {apiErrorMessage(t, error)}
      </Typography>
      {onRetry && (
        <Button variant="outlined" onClick={onRetry} sx={{ mt: 1 }}>
          {t.common.retry}
        </Button>
      )}
    </Stack>
  );
}
