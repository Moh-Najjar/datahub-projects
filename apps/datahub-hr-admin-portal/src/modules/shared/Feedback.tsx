import Alert from '@mui/material/Alert';
import Snackbar from '@mui/material/Snackbar';
import type { FeedbackMessage } from '@/modules/shared/hooks/useFeedback';

/** Announced politely by screen readers (success) or assertively (error, via the Alert role). */
export function Feedback({ message, close }: { message: FeedbackMessage | null; close: () => void }) {
  return (
    <Snackbar open={Boolean(message)} autoHideDuration={5000} onClose={(_, reason) => reason !== 'clickaway' && close()} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
      {message ? (
        <Alert severity={message.severity} variant="filled" onClose={close} role={message.severity === 'error' ? 'alert' : 'status'} sx={{ width: '100%' }}>
          {message.text}
        </Alert>
      ) : undefined}
    </Snackbar>
  );
}
