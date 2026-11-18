import { useId, type ReactNode } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import Skeleton from '@mui/material/Skeleton';
import Typography from '@mui/material/Typography';
import { useTranslation } from 'react-i18next';
import { isApiError } from '@/core/api/types';
import { visuallyHidden } from './styles';

/** Titled, outlined section (same look as the dashboard's panels). */
export function Panel({ title, subtitle, actions, children }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode; children: ReactNode }) {
  const id = useId();
  return (
    <Paper variant="outlined" component="section" aria-labelledby={id} sx={{ p: { xs: 2, sm: 2.5 }, minWidth: 0 }}>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1, mb: 2, pb: 1.5, borderBottom: 1, borderColor: 'divider' }}>
        <div>
          <Typography id={id} variant="h6" component="h2">
            {title}
          </Typography>
          {subtitle && (
            <Typography variant="body2" color="text.secondary">
              {subtitle}
            </Typography>
          )}
        </div>
        {actions}
      </Box>
      {children}
    </Paper>
  );
}

/** Label/value pairs as a description list: two columns on wider screens. */
export function DetailList({ items }: { items: ReadonlyArray<{ label: string; value: ReactNode }> }) {
  return (
    <Box component="dl" sx={{ m: 0, display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' }, columnGap: 3, rowGap: 2 }}>
      {items.map((item) => (
        <Box key={item.label} sx={{ minWidth: 0 }}>
          <Typography component="dt" variant="body2" color="text.secondary">
            {item.label}
          </Typography>
          <Typography component="dd" sx={{ m: 0, mt: 0.25, overflowWrap: 'anywhere' }}>
            {item.value}
          </Typography>
        </Box>
      ))}
    </Box>
  );
}

interface QueryBoundaryProps {
  query: { isPending: boolean; isError: boolean; error: unknown; refetch: () => unknown };
  notFoundText: string;
  /** Shown for `FORBIDDEN` (e.g. a record outside the user's team). */
  forbiddenText?: string;
  children: ReactNode;
}

/** Loading skeleton, "not found" or error + retry for a detail query; renders children once loaded. */
export function QueryBoundary({ query, notFoundText, forbiddenText, children }: QueryBoundaryProps) {
  const { t } = useTranslation();
  if (query.isPending) {
    return (
      <Box>
        <Box component="span" role="status" sx={visuallyHidden}>
          {t('shell.loading')}
        </Box>
        <Skeleton variant="rounded" height={56} sx={{ mb: 2 }} />
        <Skeleton variant="rounded" height={220} />
      </Box>
    );
  }
  if (query.isError) {
    const code = isApiError(query.error) ? query.error.code : undefined;
    const notFound = code === 'NOT_FOUND' || (code === 'FORBIDDEN' && forbiddenText !== undefined);
    return (
      <Alert
        severity={notFound ? 'warning' : 'error'}
        action={
          notFound ? undefined : (
            <Button color="inherit" size="small" onClick={() => void query.refetch()}>
              {t('actions.retry')}
            </Button>
          )
        }
      >
        {code === 'FORBIDDEN' && forbiddenText ? forbiddenText : notFound ? notFoundText : isApiError(query.error) ? t(`apiErrors.${query.error.code}`) : t('apiErrors.SERVER')}
      </Alert>
    );
  }
  return children;
}
