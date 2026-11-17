import { useState } from 'react';
import Alert from '@mui/material/Alert';
import TextField from '@mui/material/TextField';
import { useTranslation } from 'react-i18next';
import { FormDialog } from '@/modules/shared/FormDialog';
import { useUpdateRequisitionStatus } from '@/modules/recruitment/hooks/useRecruitment';
import type { Requisition, RequisitionStatus } from '@/modules/recruitment/types/recruitment';
import { errorText } from '@/modules/recruitment/utils/serverErrors';

/** Confirms a requisition status change (approve, hold, close, reopen, cancel) with an optional note. */
export function RequisitionStatusDialog({ requisition, status, onClose, onDone }: { requisition: Requisition; status: RequisitionStatus; onClose: () => void; onDone: (r: Requisition) => void }) {
  const { t } = useTranslation('recruitment');
  const { t: tCommon } = useTranslation();
  const mutation = useUpdateRequisitionStatus();
  const [note, setNote] = useState('');
  const action = t(`requisitionActions.${status}`);
  return (
    <FormDialog
      open
      title={t('requisitions.statusTitle', { action, number: requisition.number })}
      onClose={onClose}
      onSubmit={(e) => {
        e.preventDefault();
        mutation.mutate({ id: requisition.id, status, note }, { onSuccess: onDone });
      }}
      submitLabel={action}
      pending={mutation.isPending}
      error={mutation.isError ? errorText(t, tCommon, mutation.error) : undefined}
    >
      <Alert severity={status === 'cancelled' ? 'warning' : 'info'}>{t(`requisitionStatusHints.${status}`)}</Alert>
      <TextField label={t('fields.note')} multiline minRows={2} value={note} onChange={(e) => setNote(e.target.value)} slotProps={{ htmlInput: { maxLength: 300 } }} />
    </FormDialog>
  );
}
