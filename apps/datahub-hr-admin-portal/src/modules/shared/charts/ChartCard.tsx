import type { ReactNode } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import Skeleton from '@mui/material/Skeleton';
import Typography from '@mui/material/Typography';
import { useTranslation } from 'react-i18next';
import { CHART_HEIGHT } from './layout';

interface QueryState {
  isPending: boolean;
  isError: boolean;
  refetch: () => unknown;
}

/** Titled panel for one chart, with loading, error (+ retry) and empty states. */
export function ChartCard({ id, title, subtitle, query, isEmpty, children }: { id: string; title: string; subtitle: string; query: QueryState; isEmpty: boolean; children: ReactNode }) {
  const { t: tc } = useTranslation();

  let body: ReactNode;
  if (query.isPending) body = <Skeleton variant="rounded" sx={{ height: CHART_HEIGHT }} aria-label={tc('shell.loading')} />;
  else if (query.isError)
    body = (
      <Alert
        severity="error"
        action={
          <Button color="inherit" size="small" onClick={() => void query.refetch()}>
            {tc('actions.retry')}
          </Button>
        }
      >
        {tc('charts.error')}
      </Alert>
    );
  else if (isEmpty)
    body = (
      <Box sx={{ height: CHART_HEIGHT, display: 'grid', placeItems: 'center' }}>
        <Typography color="text.secondary">{tc('charts.empty')}</Typography>
      </Box>
    );
  else body = children;

  return (
    <Paper variant="outlined" component="section" aria-labelledby={`${id}-title`} sx={{ p: { xs: 2, sm: 2.5 }, minWidth: 0, height: '100%' }}>
      <Typography id={`${id}-title`} variant="h6" component="h2">
        {title}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25, mb: 2, pb: 1.5, borderBottom: 1, borderColor: 'divider' }}>
        {subtitle}
      </Typography>
      {body}
    </Paper>
  );
}
