import type { ReactNode } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { ROUTES } from '@/core/routes/paths';
import { fill, UI } from '@/i18n';
import { useLocale } from '@/i18n/LocaleContext';
import { SmartLink } from '@/modules/shared/SmartLink';
import { LanguageLink } from '@/modules/portals/components/LanguageLink';

interface AuthCardProps {
  /** The page heading (also the browser tab title). */
  title: string;
  subtitle: string;
  children: ReactNode;
}

/**
 * The Workspace's account pages (sign-in, invitation activation): "Back to website" + language switch, then a centred
 * card with the DataHub logo, the heading and the page's content.
 */
export function AuthCard({ title, subtitle, children }: AuthCardProps) {
  const { locale } = useLocale();
  const t = UI[locale].workspace;
  return (
    <Box component="main" sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'linear-gradient(135deg, #f7f8fa 0%, #eef3fb 100%)' }}>
      <title>{fill(t.pageTitle, { page: title })}</title>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', p: '12px 15px' }}>
        <Button
          component={SmartLink}
          href={ROUTES.home}
          color="inherit"
          startIcon={<ArrowBackIcon sx={{ transform: locale === 'ar' ? 'scaleX(-1)' : undefined }} />}
          sx={{ height: 40, px: 2 }}
        >
          {t.login.backToSite}
        </Button>
        <LanguageLink />
      </Box>
      <Box sx={{ flex: 1, display: 'grid', placeItems: 'center', px: '15px', pb: '40px' }}>
        <Paper variant="outlined" sx={{ width: '100%', maxWidth: 460, p: { xs: '28px 22px', sm: '40px' }, borderRadius: '8px', boxShadow: (theme) => theme.customShadows.card }}>
          <Box component={SmartLink} href={ROUTES.home} sx={{ display: 'block', width: 200, mx: 'auto' }} aria-label="Datahub Analytics">
            <Box component="img" src="/assets/logos/datahub-logo.png" srcSet="/assets/logos/datahub-logo.png 1x, /assets/logos/datahub-logo@2x.png 2x" alt="Datahub Analytics" width={250} height={46} sx={{ width: 200, height: 'auto', display: 'block' }} />
          </Box>
          <Box sx={{ height: 4, width: 56, mx: 'auto', mt: '24px', borderRadius: 2, background: 'linear-gradient(90deg, #36a829, #00469b)' }} />
          <Typography variant="h1" sx={{ mt: '20px', fontSize: 26, textAlign: 'center' }}>
            {title}
          </Typography>
          <Typography color="text.secondary" sx={{ mt: '6px', textAlign: 'center' }}>
            {subtitle}
          </Typography>
          {children}
        </Paper>
      </Box>
    </Box>
  );
}
