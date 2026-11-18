import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import { useId } from 'react';
import { useTranslation } from 'react-i18next';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  text: string;
  confirmLabel: string;
  pending: boolean;
  error?: string;
  onConfirm: () => void;
  onClose: () => void;
}

/** Confirmation for actions with consequences (deactivation). */
export function ConfirmDialog({ open, title, text, confirmLabel, pending, error, onConfirm, onClose }: ConfirmDialogProps) {
  const { t } = useTranslation();
  const titleId = useId();
  const textId = useId();
  return (
    <Dialog open={open} onClose={pending ? undefined : onClose} aria-labelledby={titleId} aria-describedby={textId} maxWidth="xs" fullWidth>
      <DialogTitle id={titleId}>{title}</DialogTitle>
      <DialogContent>
        <DialogContentText id={textId}>{text}</DialogContentText>
        {error && (
          <Alert severity="error" role="alert" sx={{ mt: 2 }}>
            {error}
          </Alert>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={pending}>
          {t('actions.cancel')}
        </Button>
        <Button color="error" variant="contained" onClick={onConfirm} disabled={pending}>
          {confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
