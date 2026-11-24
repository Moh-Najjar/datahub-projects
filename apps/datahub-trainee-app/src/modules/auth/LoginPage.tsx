import { useEffect, useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import AppsOutlinedIcon from '@mui/icons-material/AppsOutlined';
import SchoolOutlinedIcon from '@mui/icons-material/SchoolOutlined';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import WorkspacePremiumOutlinedIcon from '@mui/icons-material/WorkspacePremiumOutlined';
import { useLocation } from 'react-router-dom';
import { workspaceCheckLooping } from '@/core/auth/workspaceEnded';
import { workspaceOpenUrl } from '@/core/config/workspace';
import { useLocale } from '@/i18n/LocaleContext';
import { useT } from '@/i18n/useT';
import type { HandoffFailedState } from '@/modules/auth/SsoPage';
import { BrandMark } from '@/modules/shared/BrandMark';
import { LanguageSwitcher } from '@/modules/shared/LanguageSwitcher';

/**
 * `/login` — this app has NO sign-in form: signing in happens only in the DataHub Workspace. Signed-out visitors
 * (RequireAuth sends them here) are forwarded at once to the Workspace's `/workspace/open/academy-admin/`, which signs
 * them in when needed and comes back through `/sso`. The page stays (with a button instead of the automatic redirect)
 * when a Workspace sign-in failed, when the session check keeps ending sessions (loop guard) or when no Workspace URL
 * is configured.
 */
export default function LoginPage() {
  const t = useT();
  const { locale } = useLocale();
  const target = workspaceOpenUrl(locale);
  const handoffFailed = (useLocation().state as Partial<HandoffFailedState> | null)?.handoffFailed === true;
  const [looping] = useState(() => workspaceCheckLooping());
  const autoRedirect = Boolean(target) && !handoffFailed && !looping;

  useEffect(() => {
    if (autoRedirect && target) window.location.replace(target);
  }, [autoRedirect, target]);

  const highlights = [
    { icon: <SchoolOutlinedIcon />, text: t.auth.login.highlightTrainings },
    { icon: <TrendingUpIcon />, text: t.auth.login.highlightProgress },
    { icon: <WorkspacePremiumOutlinedIcon />, text: t.auth.login.highlightCertificates },
  ];

  return (
    <Box component="main" sx={{ minHeight: '100vh', display: 'flex', bgcolor: 'background.default' }}>
      <Box
        sx={{
          display: { xs: 'none', md: 'flex' },
          width: { md: '42%', lg: 520 },
          flexDirection: 'column',
          justifyContent: 'space-between',
          p: { md: 5, lg: 7 },
          bgcolor: 'background.paper',
          borderRight: 1,
          borderColor: 'divider',
        }}
      >
        <BrandMark />
        <Box>
          <Box aria-hidden="true" sx={{ width: 40, height: 3, borderRadius: 1, bgcolor: 'secondary.main', mb: 2.5 }} />
          <Typography variant="h4" component="p" sx={{ fontWeight: 700, maxWidth: 380 }}>
            {t.auth.login.heroTitle}
          </Typography>
          <Typography color="text.secondary" sx={{ mt: 1.5, maxWidth: 380 }}>{t.auth.login.heroBody}</Typography>
          <Stack spacing={1.75} sx={{ mt: 4 }}>
            {highlights.map((item) => (
              <Stack key={item.text} direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
                <Box aria-hidden sx={{ width: 36, height: 36, borderRadius: 1, display: 'grid', placeItems: 'center', bgcolor: 'primary.light', color: 'primary.main' }}>
                  {item.icon}
                </Box>
                <Typography>{item.text}</Typography>
              </Stack>
            ))}
          </Stack>
        </Box>
        <Typography variant="caption" color="text.secondary">
          {t.auth.login.workspaceHint}
        </Typography>
      </Box>
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', p: 2 }}>
          <LanguageSwitcher />
        </Box>
        <Box sx={{ flex: 1, display: 'grid', placeItems: 'center', px: 2, pb: 6 }}>
          <Stack spacing={3} sx={{ width: '100%', maxWidth: 460 }}>
            <Box sx={{ display: { md: 'none' } }}>
              <BrandMark />
            </Box>
            <Paper variant="outlined" sx={{ p: { xs: 3, sm: 4 } }}>
              <Typography variant="h3" component="h1">
                {t.auth.login.title}
              </Typography>
              <Typography color="text.secondary" sx={{ mt: 0.75, mb: 3 }}>
                {t.auth.login.subtitle}
              </Typography>
              <Stack spacing={2.5}>
                {handoffFailed && (
                  <Alert severity="error" role="alert">
                    {t.auth.login.handoffError}
                  </Alert>
                )}
                {!handoffFailed && looping && (
                  <Alert severity="warning" role="alert">
                    {t.auth.login.sessionCheckError}
                  </Alert>
                )}
                {!target && (
                  <Alert severity="info" role="alert">
                    {t.auth.login.notConfigured}
                  </Alert>
                )}
                {target && (
                  <div>
                    {autoRedirect && (
                      <Box role="status" sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
                        <CircularProgress size={20} />
                        <Typography>{t.auth.login.redirecting}</Typography>
                      </Box>
                    )}
                    <Button component="a" href={target} variant="contained" fullWidth size="large" startIcon={<AppsOutlinedIcon />}>
                      {t.auth.login.workspace}
                    </Button>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5, textAlign: 'center', display: { md: 'none' } }}>
                      {t.auth.login.workspaceHint}
                    </Typography>
                  </div>
                )}
              </Stack>
            </Paper>
          </Stack>
        </Box>
      </Box>
    </Box>
  );
}
