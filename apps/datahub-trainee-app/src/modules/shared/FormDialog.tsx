import type { FormEventHandler, ReactNode } from 'react';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';
import { apiErrorMessage } from '@/modules/shared/utils/apiMessage';
import { useT } from '@/i18n/useT';

interface FormDialogProps {
  open: boolean;
  title: string;
  description?: string;
  submitLabel: string;
  isSubmitting: boolean;
  /** A general (non-field) failure, shown above the actions. */
  error?: unknown;
  onClose: () => void;
  /** Pass `handleSubmit(onValid)` from React Hook Form. */
  onSubmit: FormEventHandler<HTMLFormElement>;
  maxWidth?: 'xs' | 'sm' | 'md' | 'lg';
  children: ReactNode;
}

/** A modal form: full-screen on phones, title + fields + Cancel/Submit. Closing is blocked while saving. */
export function FormDialog({ open, title, description, submitLabel, isSubmitting, error, onClose, onSubmit, maxWidth = 'sm', children }: FormDialogProps) {
  const t = useT();
  const fullScreen = useMediaQuery(useTheme().breakpoints.down('sm'));
  return (
    <Dialog open={open} onClose={isSubmitting ? undefined : onClose} fullWidth maxWidth={maxWidth} fullScreen={fullScreen} aria-labelledby="form-dialog-title">
      <form onSubmit={onSubmit} noValidate>
        <DialogTitle id="form-dialog-title">{title}</DialogTitle>
        <DialogContent dividers={false}>
          {description && <DialogContentText sx={{ mb: 2 }}>{description}</DialogContentText>}
          {children}
          {error != null && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {apiErrorMessage(t, error)}
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} disabled={isSubmitting} color="inherit">
            {t.common.cancel}
          </Button>
          <Button type="submit" variant="contained" disabled={isSubmitting}>
            {isSubmitting ? t.common.saving : submitLabel}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
