import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import { useTranslation } from 'react-i18next';
import { useRouteError } from 'react-router-dom';

/** Router `errorElement`: shown when a route throws while loading or rendering. */
export function RouteError() {
  const { t } = useTranslation();
  const error = useRouteError();
  if (import.meta.env.DEV) console.error(error);

  return (
    <Box component="main" role="alert" sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center', p: 3, textAlign: 'center' }}>
      <div>
        <Typography variant="h1" sx={{ mb: 1 }}>
          {t('errors.routeErrorTitle')}
        </Typography>
        <Typography color="text.secondary" sx={{ mb: 3 }}>
          {t('errors.routeErrorText')}
        </Typography>
        <Button variant="contained" onClick={() => window.location.reload()}>
          {t('actions.reload')}
        </Button>
      </div>
    </Box>
  );
}
