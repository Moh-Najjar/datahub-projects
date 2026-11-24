import { useState } from 'react';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import { apiErrorMessage } from '@/modules/shared/utils/apiMessage';
import { useT } from '@/i18n/useT';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  /** Destructive actions are red. */
  destructive?: boolean;
  /** Runs on confirm; the dialog closes when it resolves and shows the error when it rejects. */
  onConfirm: () => Promise<unknown> | void;
  onClose: () => void;
}

/** Confirmation for destructive or irreversible actions. */
export function ConfirmDialog({ open, title, message, confirmLabel, destructive = false, onConfirm, onClose }: ConfirmDialogProps) {
  const t = useT();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const confirm = async () => {
    setPending(true);
    setError(null);
    try {
      await onConfirm();
      onClose();
    } catch (caught) {
      setError(caught);
    } finally {
      setPending(false);
    }
  };

  return (
    <Dialog open={open} onClose={pending ? undefined : onClose} maxWidth="xs" fullWidth aria-labelledby="confirm-title">
      <DialogTitle id="confirm-title">{title}</DialogTitle>
      <DialogContent>
        <DialogContentText>{message}</DialogContentText>
        {error != null && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {apiErrorMessage(t, error)}
          </Alert>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={pending} color="inherit">
          {t.common.cancel}
        </Button>
        <Button onClick={confirm} disabled={pending} variant="contained" color={destructive ? 'error' : 'primary'} autoFocus>
          {pending ? t.common.working : confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
