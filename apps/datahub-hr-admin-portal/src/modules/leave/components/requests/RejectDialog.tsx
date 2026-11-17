import { useState } from 'react';
import TextField from '@mui/material/TextField';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { FormDialog } from '@/modules/shared/FormDialog';
import { textFieldProps } from '@/modules/shared/formFields';
import { applyServerErrors } from '@/modules/shared/utils/serverErrors';
import { useRejectLeaveRequest } from '@/modules/leave/hooks/useLeave';
import { rejectSchema, type RejectValues } from '@/modules/leave/schemas/leaveSchemas';
import type { LeaveRequest } from '@/modules/leave/types/leave';
import { errorText, fieldErrorText } from '@/modules/leave/utils/serverErrors';

/** Rejection with a required reason (shown to the employee). */
export function RejectDialog({ request, onClose, onDone }: { request: LeaveRequest; onClose: () => void; onDone: (r: LeaveRequest) => void }) {
  const { t } = useTranslation('leave');
  const { t: tCommon } = useTranslation();
  const reject = useRejectLeaveRequest();
  const [formError, setFormError] = useState<string>();
  const { register, handleSubmit, formState, setError } = useForm<RejectValues>({ resolver: zodResolver(rejectSchema), defaultValues: { reason: '' } });
  const translate = (reason: string | undefined) => fieldErrorText(t, reason);
  const onSubmit = handleSubmit((v) => {
    setFormError(undefined);
    reject.mutate(
      { id: request.id, reason: v.reason },
      {
        onSuccess: onDone,
        onError: (error) => {
          if (!applyServerErrors(error, ['reason'], setError)) setFormError(errorText(t, tCommon, error));
        },
      },
    );
  });
  return (
    <FormDialog open title={t('decide.rejectTitle', { number: request.number })} onClose={onClose} onSubmit={onSubmit} submitLabel={t('actions.reject')} pending={reject.isPending} error={formError}>
      <TextField label={t('fields.rejectionReason')} required multiline minRows={3} autoFocus {...textFieldProps(register, formState, 'reason', translate, t('decide.reasonHint'))} />
    </FormDialog>
  );
}
