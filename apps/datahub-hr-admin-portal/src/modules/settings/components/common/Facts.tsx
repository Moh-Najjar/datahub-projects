import type { ReactNode } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Skeleton from '@mui/material/Skeleton';
import Typography from '@mui/material/Typography';
import ArrowForwardOutlined from '@mui/icons-material/ArrowForwardOutlined';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink } from 'react-router-dom';

/** Label / value rows of configuration (read-only). */
export function FactList({ items }: { items: ReadonlyArray<{ label: string; value: ReactNode }> }) {
  return (
    <Box component="dl" sx={{ m: 0, display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'minmax(180px, 1fr) minmax(0, 2fr)' }, columnGap: 3, rowGap: { xs: 0.5, md: 1.5 } }}>
      {items.map((item) => (
        <Box key={item.label} sx={{ display: 'contents' }}>
          <Typography component="dt" variant="body2" color="text.secondary" sx={{ mt: { xs: 1.5, md: 0 } }}>
            {item.label}
          </Typography>
          <Typography component="dd" variant="body2" sx={{ m: 0, overflowWrap: 'anywhere' }}>
            {item.value}
          </Typography>
        </Box>
      ))}
    </Box>
  );
}

/** Links to the module screens that own this configuration. */
export function ManageLinks({ links }: { links: ReadonlyArray<{ to: string; label: string }> }) {
  const { t } = useTranslation('settings');
  return (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
      {links.map((l) => (
        <Button key={l.to} component={RouterLink} to={l.to} variant="outlined" size="small" endIcon={<ArrowForwardOutlined sx={(theme) => ({ transform: theme.direction === 'rtl' ? 'scaleX(-1)' : undefined })} />}>
          {t('manageIn', { module: l.label })}
        </Button>
      ))}
    </Box>
  );
}

/** Loading / error state of a summary query. */
export function QueryState({ query, children }: { query: { isPending: boolean; isError: boolean; refetch: () => unknown; fetchStatus?: string }; children: ReactNode }) {
  const { t } = useTranslation('settings');
  const { t: tc } = useTranslation();
  if (query.isPending && query.fetchStatus !== 'idle') return <Skeleton variant="rounded" height={120} />;
  if (query.isError)
    return (
      <Alert
        severity="error"
        action={
          <Button color="inherit" size="small" onClick={() => void query.refetch()}>
            {tc('actions.retry')}
          </Button>
        }
      >
        {t('form.loadError')}
      </Alert>
    );
  return <>{children}</>;
}
