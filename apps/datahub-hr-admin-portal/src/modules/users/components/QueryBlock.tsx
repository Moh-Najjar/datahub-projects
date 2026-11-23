import type { ReactNode } from 'react';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Skeleton from '@mui/material/Skeleton';
import { useTranslation } from 'react-i18next';

/** Loading skeleton or error + retry around a query's content. */
export function QueryBlock({ query, children }: { query: { isPending: boolean; isError: boolean; refetch: () => unknown }; children: ReactNode }) {
  const { t } = useTranslation();
  if (query.isPending) return <Skeleton variant="rounded" height={200} />;
  if (query.isError)
    return (
      <Alert
        severity="error"
        action={
          <Button color="inherit" size="small" onClick={() => void query.refetch()}>
            {t('actions.retry')}
          </Button>
        }
      >
        {t('list.loadError')}
      </Alert>
    );
  return <>{children}</>;
}
