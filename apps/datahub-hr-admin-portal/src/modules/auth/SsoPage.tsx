import { useEffect, useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import { useTranslation } from 'react-i18next';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/core/context/authContext';
import { authApi } from '@/modules/auth/api/authApi';
import { readHandoffToken } from '@/modules/auth/handoff/workspaceHandoff';

/** Location state that tells the sign-in page a Workspace sign-in failed. */
export interface HandoffFailedState {
  handoffFailed: true;
}

/**
 * `/sso#token=…` — single sign-in from the DataHub Workspace (public, outside `RequireAuth`). Reads the token from the
 * hash ONCE, removes it from the address bar and history entry, exchanges it for this portal's session
 * (`authApi.exchangeHandoff`) and goes to `/` (the role's landing page) — no sign-in form. A missing, expired or invalid
 * token ends any previous session in this tab and shows `/login` with a short error (without redirecting again).
 */
export default function SsoPage() {
  const { t } = useTranslation('auth');
  const { signIn, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  // Read during the first render, before the effect below strips the hash.
  const [token] = useState(() => readHandoffToken(location.hash));
  const started = useRef(false);

  const exchange = useMutation({
    mutationFn: (value: string | null) => authApi.exchangeHandoff(value),
    onSuccess: signIn,
    onError: signOut,
  });
  const { mutate } = exchange;

  useEffect(() => {
    if (started.current) return; // StrictMode runs effects twice in development.
    started.current = true;
    // The token must not stay in the URL, the history entry or anything copied from the address bar.
    navigate({ pathname: location.pathname, search: location.search }, { replace: true });
    mutate(token);
  }, [mutate, token, navigate, location.pathname, location.search]);

  if (exchange.isSuccess) return <Navigate to="/" replace />;
  if (exchange.isError) return <Navigate to="/login" replace state={{ handoffFailed: true } satisfies HandoffFailedState} />;

  return (
    <Box component="main" role="status" sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center', bgcolor: 'background.default', px: 2 }}>
      <Paper variant="outlined" sx={{ px: { xs: 3, sm: 4 }, py: 3, display: 'flex', alignItems: 'center', gap: 2 }}>
        <CircularProgress size={22} />
        <Typography>{t('sso.signingIn')}</Typography>
      </Paper>
    </Box>
  );
}
