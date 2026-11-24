import { useCallback, useMemo, useState, type ReactNode } from 'react';
import Alert from '@mui/material/Alert';
import Snackbar from '@mui/material/Snackbar';
import { FeedbackContext, type FeedbackApi, type Severity } from './hooks/feedbackContext';

/** One snackbar for the whole app: confirmations of saved/deleted/updated records. */
export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState<{ text: string; severity: Severity; key: number } | null>(null);
  const show = useCallback((severity: Severity) => (text: string) => setMessage({ text, severity, key: Date.now() }), []);
  const api = useMemo<FeedbackApi>(() => ({ success: show('success'), error: show('error'), info: show('info') }), [show]);

  return (
    <FeedbackContext value={api}>
      {children}
      <Snackbar key={message?.key} open={message !== null} autoHideDuration={4500} onClose={(_, reason) => reason !== 'clickaway' && setMessage(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        {message ? (
          <Alert severity={message.severity} variant="filled" onClose={() => setMessage(null)} sx={{ width: '100%' }}>
            {message.text}
          </Alert>
        ) : undefined}
      </Snackbar>
    </FeedbackContext>
  );
}
