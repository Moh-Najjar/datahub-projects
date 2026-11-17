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
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { ADMIN_ROUTES } from '@/core/routes/paths';
import { AuthError, DEV_CREDENTIALS_HINT, signIn } from '@/modules/admin/api/authService';
import { ADMIN_TEXT } from '@/modules/admin/data/adminText';
import { useAdminSession } from '@/modules/admin/hooks/useAdminSession';

const T = ADMIN_TEXT.login;

const schema = z.object({
  username: z.string().trim().min(1, T.usernameRequired),
  password: z.string().min(1, T.passwordRequired),
});
type Values = z.infer<typeof schema>;

/** Only same-area destinations are honoured after sign-in. */
function safeTarget(from: unknown): string {
  return typeof from === 'string' && from.startsWith(ADMIN_ROUTES.root) && !from.startsWith(ADMIN_ROUTES.login) ? from : ADMIN_ROUTES.blogs;
}

/** `/admin/login/` — sign-in for the admin area (temporary mock authentication). */
export default function AdminLoginPage() {
  const session = useAdminSession();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: unknown } | null)?.from;
  const [error, setError] = useState<string>();
  const [showPassword, setShowPassword] = useState(false);
  const { register, handleSubmit, formState } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { username: '', password: '' } });

  if (session && !formState.isSubmitting) return <Navigate to={safeTarget(from)} replace />;

  const onSubmit = handleSubmit(async ({ username, password }) => {
    setError(undefined);
    try {
      await signIn(username, password);
      navigate(safeTarget(from), { replace: true });
    } catch (e) {
      setError(e instanceof AuthError ? T.invalid : ADMIN_TEXT.validation.generic);
    }
  });

  return (
    <Box component="main" sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center', px: '15px', py: '40px', background: 'linear-gradient(135deg, #f7f8fa 0%, #eef3fb 100%)' }}>
      <title>{ADMIN_TEXT.pageTitle(T.title)}</title>
      <Paper variant="outlined" sx={{ width: '100%', maxWidth: 420, p: { xs: '28px 22px', sm: '40px' }, borderRadius: '8px', boxShadow: (t) => t.customShadows.card }}>
        <Box component="img" src="/assets/logos/datahub-logo.png" srcSet="/assets/logos/datahub-logo.png 1x, /assets/logos/datahub-logo@2x.png 2x" alt="Datahub Analytics" width={250} height={46} sx={{ width: 200, height: 'auto', mx: 'auto' }} />
        <Box sx={{ height: 4, width: 56, mx: 'auto', mt: '24px', borderRadius: 2, background: 'linear-gradient(90deg, #36a829, #00469b)' }} />
        <Typography variant="h1" sx={{ mt: '20px', fontSize: 26, textAlign: 'center' }}>
          {T.title}
        </Typography>
        <Typography color="text.secondary" sx={{ mt: '6px', textAlign: 'center' }}>
          {T.subtitle}
        </Typography>

        <Box component="form" noValidate onSubmit={onSubmit} sx={{ mt: '28px', display: 'grid', gap: '18px' }}>
          {error && <Alert severity="error">{error}</Alert>}
          {!error && (location.state as { from?: unknown } | null)?.from !== undefined && <Alert severity="info">{T.expired}</Alert>}
          <TextField
            label={T.username}
            autoComplete="username"
            autoFocus
            required
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

        <Typography variant="body2" color="text.secondary" sx={{ mt: '22px', textAlign: 'center', fontSize: 13 }}>
          {ADMIN_TEXT.prototypeNotice}
        </Typography>
        {DEV_CREDENTIALS_HINT && (
          <Typography variant="body2" sx={{ mt: '8px', textAlign: 'center', fontSize: 13, color: 'brand.heading' }}>
            {T.devHint(DEV_CREDENTIALS_HINT.username, DEV_CREDENTIALS_HINT.password)}
          </Typography>
        )}
      </Paper>
    </Box>
  );
}
