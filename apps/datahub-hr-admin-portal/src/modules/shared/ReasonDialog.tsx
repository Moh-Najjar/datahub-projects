import { useId, useState, type ReactNode } from 'react';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import TextField from '@mui/material/TextField';
import { useTranslation } from 'react-i18next';

interface Props {
  open: boolean;
  title: string;
  text: ReactNode;
  confirmLabel: string;
  /** A reason must be entered (sign-in & session changes, demo reset). */
  reasonRequired?: boolean;
  pending: boolean;
  error?: string;
  danger?: boolean;
  onConfirm: (reason: string) => void;
  onClose: () => void;
}

/** Confirmation of a sensitive change, with the reason recorded in the audit log (settings, users and roles). */
export function ReasonDialog({ open, title, text, confirmLabel, reasonRequired = false, pending, error, danger = false, onConfirm, onClose }: Props) {
  const { t: tc } = useTranslation();
  const titleId = useId();
  const textId = useId();
  const [reason, setReason] = useState('');
  const [touched, setTouched] = useState(false);
  const missing = reasonRequired && !reason.trim();
  const close = () => {
    if (pending) return;
    setReason('');
    setTouched(false);
    onClose();
  };
  return (
    <Dialog open={open} onClose={close} aria-labelledby={titleId} aria-describedby={textId} maxWidth="sm" fullWidth>
      <DialogTitle id={titleId}>{title}</DialogTitle>
      <DialogContent>
        <DialogContentText id={textId} component="div" sx={{ mb: 2 }}>
          {text}
        </DialogContentText>
        <TextField
          label={tc('reasonDialog.label')}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          onBlur={() => setTouched(true)}
          required={reasonRequired}
          error={touched && missing}
          helperText={touched && missing ? tc('reasonDialog.required') : reasonRequired ? tc('reasonDialog.requiredHint') : tc('reasonDialog.hint')}
          fullWidth
          multiline
          minRows={2}
          slotProps={{ htmlInput: { maxLength: 300 } }}
        />
        {error && (
          <Alert severity="error" role="alert" sx={{ mt: 2 }}>
            {error}
          </Alert>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={close} disabled={pending}>
          {tc('actions.cancel')}
        </Button>
        <Button
          variant="contained"
          color={danger ? 'error' : 'primary'}
          disabled={pending}
          onClick={() => {
            setTouched(true);
            if (!missing) onConfirm(reason.trim());
          }}
        >
          {confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
