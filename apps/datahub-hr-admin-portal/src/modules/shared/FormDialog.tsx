import type { FormEventHandler, ReactNode } from 'react';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Stack from '@mui/material/Stack';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';
import { useId } from 'react';
import { useTranslation } from 'react-i18next';

interface FormDialogProps {
  open: boolean;
  title: string;
  onClose: () => void;
  onSubmit: FormEventHandler<HTMLFormElement>;
  submitLabel: string;
  pending: boolean;
  /** Error not tied to a field (network, server…). */
  error?: string;
  /** Optional extra action before the main one (e.g. "Save as draft"); it does not submit the form. */
  secondaryAction?: { label: string; onClick: () => void };
  /** Wider dialog for forms with a side summary. */
  maxWidth?: 'sm' | 'md';
  children: ReactNode;
}

/** Dialog that is a form: title, fields, error, Cancel / Save. Full screen on phones. */
export function FormDialog({ open, title, onClose, onSubmit, submitLabel, pending, error, secondaryAction, maxWidth = 'sm', children }: FormDialogProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));
  const titleId = useId();

  return (
    <Dialog
      open={open}
      onClose={pending ? undefined : onClose}
      fullScreen={fullScreen}
      fullWidth
      maxWidth={maxWidth}
      aria-labelledby={titleId}
      slotProps={{ paper: { component: 'form', noValidate: true, onSubmit } as object }}
    >
      <DialogTitle id={titleId}>{title}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2.5}>
          {error && (
            <Alert severity="error" role="alert">
              {error}
            </Alert>
          )}
          {children}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose} disabled={pending}>
          {t('actions.cancel')}
        </Button>
        {secondaryAction && (
          <Button variant="outlined" onClick={secondaryAction.onClick} disabled={pending}>
            {secondaryAction.label}
          </Button>
        )}
        <Button type="submit" variant="contained" disabled={pending}>
          {pending ? t('actions.saving') : submitLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
