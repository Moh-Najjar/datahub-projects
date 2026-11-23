import { useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import Paper from '@mui/material/Paper';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import VisibilityOffOutlinedIcon from '@mui/icons-material/VisibilityOffOutlined';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { ROUTES, WORKSPACE_ROUTES } from '@/core/routes/paths';
import { fill, UI } from '@/i18n';
import { useLocale } from '@/i18n/LocaleContext';
import { localizePath, stripLocale } from '@/i18n/paths';
import { SmartLink } from '@/modules/shared/SmartLink';
import { AuthError } from '@/modules/portals/api/workspaceAuth';
import { LanguageLink } from '@/modules/portals/components/LanguageLink';
import { useWorkspaceSession } from '@/modules/portals/hooks/useWorkspaceSession';
import { useSignIn } from '@/modules/portals/hooks/useSignIn';
import type { WorkspaceLocationState } from '@/modules/portals/types';

/** Only pages of this site's staff areas are valid return targets. */
function safeTarget(from: unknown): string | undefined {
  if (typeof from !== 'string' || !from.startsWith('/') || from.startsWith('//')) return undefined;
  const neutral = stripLocale(from);
  const isStaffPage = neutral.startsWith('/admin/') || (neutral.startsWith(WORKSPACE_ROUTES.root) && !neutral.startsWith(WORKSPACE_ROUTES.login) && !neutral.startsWith(WORKSPACE_ROUTES.logout));
  return isStaffPage ? from : undefined;
}

/**
 * `/workspace/login/` — the ONE sign-in of DataHub's staff applications: email + password, verified by the backend
 * (`POST /api/v1/auth/login`). The password is never stored or logged and is cleared after signing in.
 */
export default function WorkspaceLoginPage() {
  const { locale } = useLocale();
  const t = UI[locale].workspace;
  const T = t.login;
  const session = useWorkspaceSession();
  const navigate = useNavigate();
  const state = (useLocation().state ?? null) as WorkspaceLocationState | null;
  const [error, setError] = useState<string>();
  const signInMutation = useSignIn();
  const [showPassword, setShowPassword] = useState(false);

  const schema = z.object({
    username: z.string().trim().min(1, T.usernameRequired),
    password: z.string().min(1, T.passwordRequired),
  });
  type Values = z.infer<typeof schema>;
  const { register, handleSubmit, formState, reset } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { username: '', password: '' } });

  const target = safeTarget(state?.from) ?? localizePath(WORKSPACE_ROUTES.root, locale);
  // Already signed in (e.g. the header's Workspace link in another tab): straight to the Workspace.
  if (session && !formState.isSubmitting) return <Navigate to={target} replace />;

  const onSubmit = handleSubmit(async ({ username, password }) => {
    setError(undefined);
    try {
      await signInMutation.mutateAsync({ username, password });
      reset({ username, password: '' });
      navigate(target, { replace: true });
    } catch (e) {
      setError(e instanceof AuthError ? T.invalid : T.generic);
    }
  });

  return (
    <Box component="main" sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'linear-gradient(135deg, #f7f8fa 0%, #eef3fb 100%)' }}>
      <title>{fill(t.pageTitle, { page: T.title })}</title>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', p: '12px 15px' }}>
        <Button
          component={SmartLink}
          href={ROUTES.home}
          color="inherit"
          startIcon={<ArrowBackIcon sx={{ transform: locale === 'ar' ? 'scaleX(-1)' : undefined }} />}
          sx={{ height: 40, px: 2 }}
        >
          {T.backToSite}
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
            {T.title}
          </Typography>
          <Typography color="text.secondary" sx={{ mt: '6px', textAlign: 'center' }}>
            {T.subtitle}
          </Typography>

          <Box component="form" noValidate onSubmit={onSubmit} sx={{ mt: '28px', display: 'grid', gap: '18px' }}>
            {error && <Alert severity="error">{error}</Alert>}
            {!error && state?.signedOut && <Alert severity="success">{T.signedOut}</Alert>}
            {!error && !state?.signedOut && state?.from && <Alert severity="info">{T.signInRequired}</Alert>}
            <TextField
              label={T.username}
              type="email"
              autoComplete="username"
              autoFocus
              required
              slotProps={{ htmlInput: { dir: 'ltr', spellCheck: false, autoCapitalize: 'none' } }}
              {...register('username')}
              error={Boolean(formState.errors.username)}
              helperText={formState.errors.username?.message}
            />
            <TextField
              label={T.password}
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              required
              {...register('password')}
              error={Boolean(formState.errors.password)}
              helperText={formState.errors.password?.message}
              slotProps={{
                input: {
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton onClick={() => setShowPassword((v) => !v)} aria-label={showPassword ? T.hidePassword : T.showPassword} edge="end">
                        {showPassword ? <VisibilityOffOutlinedIcon /> : <VisibilityOutlinedIcon />}
                      </IconButton>
                    </InputAdornment>
                  ),
                },
              }}
            />
            <Button type="submit" variant="contained" disabled={formState.isSubmitting} sx={{ height: 48, fontSize: 15, fontWeight: 500 }}>
              {formState.isSubmitting ? T.submitting : T.submit}
            </Button>
          </Box>

        </Paper>
      </Box>
    </Box>
  );
}
