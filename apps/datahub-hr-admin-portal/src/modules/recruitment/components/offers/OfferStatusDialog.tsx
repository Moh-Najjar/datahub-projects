import { useState } from 'react';
import Alert from '@mui/material/Alert';
import TextField from '@mui/material/TextField';
import { useTranslation } from 'react-i18next';
import { FormDialog } from '@/modules/shared/FormDialog';
import { useUpdateOfferStatus } from '@/modules/recruitment/hooks/useRecruitment';
import type { Offer, OfferStatus } from '@/modules/recruitment/types/recruitment';
import { errorText } from '@/modules/recruitment/utils/serverErrors';

/** Send (simulated), record the candidate's answer, or withdraw — with an optional note. */
export function OfferStatusDialog({ offer, status, onClose, onDone }: { offer: Offer; status: OfferStatus; onClose: () => void; onDone: (o: Offer) => void }) {
  const { t } = useTranslation('recruitment');
  const { t: tCommon } = useTranslation();
  const mutation = useUpdateOfferStatus();
  const [note, setNote] = useState('');
  return (
    <FormDialog
      open
      title={t('offers.statusTitle', { action: t(`offerActions.${status}`), number: offer.number })}
      onClose={onClose}
      onSubmit={(e) => {
        e.preventDefault();
        mutation.mutate({ id: offer.id, status, note }, { onSuccess: onDone });
      }}
      submitLabel={t(`offerActions.${status}`)}
      pending={mutation.isPending}
      error={mutation.isError ? errorText(t, tCommon, mutation.error) : undefined}
    >
      <Alert severity={status === 'accepted' ? 'success' : status === 'sent' ? 'info' : 'warning'}>{t(`offerStatusHints.${status}`)}</Alert>
      <TextField label={t('fields.note')} multiline minRows={2} value={note} onChange={(e) => setNote(e.target.value)} slotProps={{ htmlInput: { maxLength: 300 } }} />
    </FormDialog>
  );
}
