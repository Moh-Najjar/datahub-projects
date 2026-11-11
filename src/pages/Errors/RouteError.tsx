import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import { isRouteErrorResponse, useLocation, useRouteError } from 'react-router-dom';
import { LocaleProvider } from '@/i18n/LocaleProvider';
import { localeFromPath } from '@/i18n/paths';
import { UI } from '@/i18n/ui';
import { AppThemeProvider } from '@/theme/AppThemeProvider';

/**
 * Router error boundary. It renders outside the normal layout, so it provides its own
 * locale and theme and keeps the markup minimal.
 */
export function RouteError() {
  const error = useRouteError();
  const locale = localeFromPath(useLocation().pathname);
  const ui = UI[locale];
  const detail = isRouteErrorResponse(error) ? `${error.status} ${error.statusText}` : error instanceof Error ? error.message : '';

  if (import.meta.env.DEV) console.error(error);

  return (
    <LocaleProvider locale={locale}>
      <AppThemeProvider>
        <Container sx={{ py: '150px', textAlign: 'center' }}>
          <Typography variant="h2" component="h1" sx={{ mb: '20px' }}>
            {ui.notFound.title}
          </Typography>
          {detail && <Typography sx={{ mb: '30px' }}>{detail}</Typography>}
          <a href={locale === 'ar' ? '/ar/' : '/'}>{ui.notFound.backHome}</a>
        </Container>
      </AppThemeProvider>
    </LocaleProvider>
  );
}
