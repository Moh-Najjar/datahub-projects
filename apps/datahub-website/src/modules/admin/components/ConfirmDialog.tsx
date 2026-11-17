import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  text: string;
  confirmLabel: string;
  cancelLabel: string;
  danger?: boolean;
  pending?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/** A yes/no question before a destructive action. */
export function ConfirmDialog({ open, title, text, confirmLabel, cancelLabel, danger, pending, onConfirm, onCancel }: ConfirmDialogProps) {
  return (
    <Dialog open={open} onClose={pending ? undefined : onCancel} aria-labelledby="confirm-title" aria-describedby="confirm-text" maxWidth="xs" fullWidth>
      <DialogTitle id="confirm-title" sx={{ fontSize: 20, color: 'brand.heading' }}>
        {title}
      </DialogTitle>
      <DialogContent>
        <DialogContentText id="confirm-text">{text}</DialogContentText>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button onClick={onCancel} disabled={pending} sx={{ height: 40, px: 2 }}>
          {cancelLabel}
        </Button>
        <Button variant="contained" color={danger ? 'error' : 'primary'} onClick={onConfirm} disabled={pending} sx={{ height: 40, px: 2.5 }}>
          {confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
