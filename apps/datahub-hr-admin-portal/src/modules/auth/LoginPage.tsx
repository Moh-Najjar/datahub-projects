import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useTranslation } from 'react-i18next';
import { isApiError } from '@/core/api/types';
import type { LoginRequest } from '@/modules/auth/api/authApi';
import { DemoAccountList } from '@/modules/auth/components/DemoAccountList';
import { LoginForm } from '@/modules/auth/components/LoginForm';
import { useLogin } from '@/modules/auth/hooks/useLogin';
import { BrandMark } from '@/modules/shared/BrandMark';
import { DemoModeNotice } from '@/modules/shared/DemoModeNotice';
import { LanguageSwitcher } from '@/modules/shared/LanguageSwitcher';
import { ThemeModeSwitcher } from '@/modules/shared/ThemeModeSwitcher';

/**
 * Mock sign-in: email form or one-click demo accounts, always under the demo-mode warning. After a
 * successful sign-in the /login route's guard redirects (to the requested page or the role's landing page).
 */
export default function LoginPage() {
  const { t } = useTranslation('auth');
  const login = useLogin();
  const submit = (request: LoginRequest) => login.mutate(request);

  const error = login.error ? (isApiError(login.error) && login.error.code === 'UNAUTHORIZED' ? t('login.errors.unknownAccount') : t('login.errors.generic')) : null;

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
              {error && (
                <Alert severity="error" role="alert">
                  {error}
                </Alert>
              )}
              <LoginForm onSubmit={submit} pending={login.isPending} />
              <Divider />
              <div>
                <Typography variant="h6" component="h2">
                  {t('login.demoAccountsTitle')}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, mb: 2 }}>
                  {t('login.demoAccountsHint')}
                </Typography>
                <DemoAccountList onSelect={(email) => submit({ email, password: '' })} pending={login.isPending} />
              </div>
            </Stack>
          </Paper>
        </Stack>
      </Box>
    </Box>
  );
}
