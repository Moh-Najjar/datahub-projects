import { useEffect, useRef, useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import VisibilityOffOutlinedIcon from '@mui/icons-material/VisibilityOffOutlined';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Link as RouterLink, useNavigate, useSearchParams } from 'react-router-dom';
import { z } from 'zod';
import { activationFailureOf, MIN_PASSWORD_LENGTH } from '@/core/api/auth';
import { useActivateInvitation } from '@/core/hooks/useActivateInvitation';
import { WORKSPACE_ROUTES } from '@/core/routes/paths';
import { UI } from '@/i18n';
import { useLocale } from '@/i18n/LocaleContext';
import { localizePath } from '@/i18n/paths';
import { AuthCard } from '@/modules/portals/components/AuthCard';

/** After a successful activation the page moves on to the sign-in page by itself after this delay. */
const ACTIVATION_REDIRECT_MS = 6000;

/**
 * `/activate?token=…` — activates an invited account: the invitation e-mail's link carries a single-use, expiring token;
 * the user chooses a password (≥ 12 characters) and `POST /api/v1/auth/activate-invitation` (anonymous) answers 204.
 * Then on to the Workspace sign-in. The token is read from the URL only, sent only to the API, never logged or stored,
 * and the page asks the browser not to send its address as a referrer.
 */
export default function ActivateInvitationPage() {
  const { locale } = useLocale();
  const T = UI[locale].workspace.activate;
  const login = UI[locale].workspace.login;
  const [params] = useSearchParams();
  // The e-mail encodes the token (base64: `%2B` = `+`). A `+` left unencoded would arrive as a space — tokens
  // contain no spaces, so spaces are turned back into `+`.
  const token = (params.get('token') ?? '').trim().replace(/ /g, '+');
  const activation = useActivateInvitation();
  const navigate = useNavigate();
  const loginPath = localizePath(WORKSPACE_ROUTES.login, locale);
  const [failure, setFailure] = useState<string>();
  const [showPassword, setShowPassword] = useState(false);
  const failureRef = useRef<HTMLDivElement>(null);
  const successRef = useRef<HTMLDivElement>(null);

  const schema = z
    .object({
      newPassword: z.string().min(1, T.passwordRequired).min(MIN_PASSWORD_LENGTH, T.passwordTooShort),
      confirmPassword: z.string().min(1, T.confirmRequired),
    })
    .refine((v) => v.newPassword === v.confirmPassword, { path: ['confirmPassword'], message: T.mismatch });
  type Values = z.infer<typeof schema>;
  const { register, handleSubmit, formState, setError, reset } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { newPassword: '', confirmPassword: '' } });

  const activated = activation.isSuccess;

  // Success: announce it, move focus to it, then go on to sign-in.
  useEffect(() => {
    if (!activated) return undefined;
    successRef.current?.focus();
    const timer = window.setTimeout(() => navigate(loginPath, { replace: true }), ACTIVATION_REDIRECT_MS);
    return () => window.clearTimeout(timer);
  }, [activated, loginPath, navigate]);

  // A failure message takes the focus so keyboard and screen-reader users land on it.
  useEffect(() => {
    if (failure) failureRef.current?.focus();
  }, [failure]);

  const onSubmit = handleSubmit(async ({ newPassword }) => {
    setFailure(undefined);
    try {
      await activation.mutateAsync({ token, newPassword });
      reset({ newPassword: '', confirmPassword: '' });
    } catch (error) {
      const reason = activationFailureOf(error);
      if (reason === 'weakPassword') setError('newPassword', { type: 'server', message: T.weakPassword }, { shouldFocus: true });
      else setFailure(reason === 'invalidToken' ? T.invalidToken : T.failed);
    }
  });

  const passwordToggle = (
    <InputAdornment position="end">
      <IconButton onClick={() => setShowPassword((v) => !v)} aria-label={showPassword ? login.hidePassword : login.showPassword} aria-pressed={showPassword} edge="end">
        {showPassword ? <VisibilityOffOutlinedIcon /> : <VisibilityOutlinedIcon />}
      </IconButton>
    </InputAdornment>
  );

  return (
    <AuthCard title={T.title} subtitle={T.subtitle}>
      {/* The token is in this page's address: never send it to other sites as a referrer. */}
      <meta name="referrer" content="no-referrer" />
      <Box sx={{ mt: '28px', display: 'grid', gap: '18px' }}>
        {!token ? (
          <Alert severity="error" role="alert">
            {T.missingToken}
          </Alert>
        ) : activated ? (
          <>
            <Alert severity="success" role="status" ref={successRef} tabIndex={-1} sx={{ '&:focus': { outline: 'none' }, '&:focus-visible': { outline: '2px solid', outlineColor: 'success.main' } }}>
              <Typography component="p" sx={{ fontWeight: 500 }}>
                {T.success}
              </Typography>
              <Typography component="p" variant="body2" sx={{ mt: '4px' }}>
                {T.successNext}
              </Typography>
            </Alert>
            <Button component={RouterLink} to={loginPath} replace variant="contained" sx={{ height: 48, fontSize: 15, fontWeight: 500 }}>
              {T.continue}
            </Button>
          </>
        ) : (
          <Box component="form" noValidate onSubmit={onSubmit} aria-busy={activation.isPending} sx={{ display: 'grid', gap: '18px' }}>
            {failure && (
              <Alert severity="error" role="alert" ref={failureRef} tabIndex={-1}>
                {failure}
              </Alert>
            )}
            <TextField
              label={T.newPassword}
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              autoFocus
              required
              {...register('newPassword')}
              error={Boolean(formState.errors.newPassword)}
              helperText={formState.errors.newPassword?.message ?? T.passwordHint}
              slotProps={{ htmlInput: { dir: 'ltr', minLength: MIN_PASSWORD_LENGTH }, input: { endAdornment: passwordToggle } }}
            />
            <TextField
              label={T.confirmPassword}
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              required
              {...register('confirmPassword')}
              error={Boolean(formState.errors.confirmPassword)}
              helperText={formState.errors.confirmPassword?.message}
              slotProps={{ htmlInput: { dir: 'ltr' } }}
            />
            <Button type="submit" variant="contained" loading={activation.isPending} loadingPosition="start" disabled={activation.isPending} sx={{ height: 48, fontSize: 15, fontWeight: 500 }}>
              {activation.isPending ? T.submitting : T.submit}
            </Button>
          </Box>
        )}
      </Box>
    </AuthCard>
  );
}
