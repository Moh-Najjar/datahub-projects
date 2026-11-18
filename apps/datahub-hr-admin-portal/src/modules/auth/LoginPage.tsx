import { useEffect, useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import AppsOutlined from '@mui/icons-material/AppsOutlined';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';
import { workspaceOpenUrl } from '@/core/config/workspace';
import { workspaceCheckLooping } from '@/core/context/workspaceEnded';
import { useLanguage } from '@/i18n/useLanguage';
import type { HandoffFailedState } from '@/modules/auth/SsoPage';
import { BrandMark } from '@/modules/shared/BrandMark';
import { DemoModeNotice } from '@/modules/shared/DemoModeNotice';
import { LanguageSwitcher } from '@/modules/shared/LanguageSwitcher';
import { ThemeModeSwitcher } from '@/modules/shared/ThemeModeSwitcher';

/**
 * `/login` — this portal has NO sign-in form: signing in happens only in the DataHub Workspace. Signed-out visitors
 * (RequireAuth sends them here) are forwarded at once to the Workspace's `/workspace/open/hr-admin/`, which signs them
 * in when needed and comes back through `/sso`. The page stays (with a button instead of the automatic redirect) when
 * a Workspace sign-in failed, when the session check keeps ending sessions (loop guard) or when no Workspace URL is
 * configured.
 */
export default function LoginPage() {
  const { t } = useTranslation('auth');
  const { language } = useLanguage();
  const target = workspaceOpenUrl(language);
  const handoffFailed = (useLocation().state as Partial<HandoffFailedState> | null)?.handoffFailed === true;
  const [looping] = useState(() => workspaceCheckLooping());
  const autoRedirect = Boolean(target) && !handoffFailed && !looping;

  useEffect(() => {
    if (autoRedirect && target) window.location.replace(target);
  }, [autoRedirect, target]);

  return (
    <Box component="main" sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', bgcolor: 'background.default' }}>
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 1, p: 2 }}>
        <LanguageSwitcher />
        <ThemeModeSwitcher />
      </Box>
      <Box sx={{ flex: 1, display: 'grid', placeItems: 'center', px: 2, pb: 6 }}>
        <Stack spacing={3} sx={{ width: '100%', maxWidth: 520 }}>
          <BrandMark />
          <Paper variant="outlined" sx={{ p: { xs: 3, sm: 4 } }}>
            <Typography variant="h2" component="h1">
              {t('login.title')}
            </Typography>
            <Typography color="text.secondary" sx={{ mt: 0.5, mb: 3 }}>
              {t('login.subtitle')}
            </Typography>
            <Stack spacing={3}>
              <DemoModeNotice variant="full" />
              {handoffFailed && (
                <Alert severity="error" role="alert">
                  {t('login.errors.handoff')}
                </Alert>
              )}
              {!handoffFailed && looping && (
                <Alert severity="warning" role="alert">
                  {t('login.errors.sessionCheck')}
                </Alert>
              )}
              {!target && (
                <Alert severity="info" role="alert">
                  {t('login.notConfigured')}
                </Alert>
              )}
              {target && (
                <div>
                  {autoRedirect && (
                    <Box role="status" sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
                      <CircularProgress size={20} />
                      <Typography>{t('login.redirecting')}</Typography>
                    </Box>
                  )}
                  <Button component="a" href={target} variant="contained" fullWidth size="large" startIcon={<AppsOutlined />}>
                    {t('login.workspace')}
                  </Button>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1, textAlign: 'center' }}>
                    {t('login.workspaceHint')}
                  </Typography>
                </div>
              )}
            </Stack>
          </Paper>
        </Stack>
      </Box>
    </Box>
  );
}
