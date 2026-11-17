import { useId, useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import TextField from '@mui/material/TextField';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, type Path } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { isApiError } from '@/core/api/types';
import { useDepartmentOptions } from '@/modules/organization';
import { FormDialog } from '@/modules/shared/FormDialog';
import { textFieldProps } from '@/modules/shared/formFields';
import { SelectField } from '@/modules/shared/SelectField';
import { useCreateRun, useUpdateRun } from '@/modules/payroll/hooks/usePayroll';
import { reasonFormSchema, runFormSchema, toRunInput, type ReasonFormValues, type RunFormValues } from '@/modules/payroll/schemas/payrollSchemas';
import { CURRENCIES, PAY_FREQUENCIES, type PayrollRun } from '@/modules/payroll/types/payroll';
import { addMonths, monthEnd, monthOf, todayIso } from '@/modules/payroll/utils/rules';
import { errorText, fieldErrorText } from '@/modules/payroll/utils/serverErrors';

const RUN_FIELDS = ['month', 'paymentDate', 'departmentId', 'currency', 'payFrequency'] as const;
const ltr = { inputLabel: { shrink: true }, htmlInput: { dir: 'ltr' } } as const;

/** Create / edit a run: one calendar month, a department (or all), the currency and the payment date. */
export function RunFormDialog({ run, onClose, onDone }: { run?: PayrollRun; onClose: () => void; onDone: (r: PayrollRun) => void }) {
  const { t } = useTranslation('payroll');
  const { t: tCommon } = useTranslation();
  const create = useCreateRun();
  const update = useUpdateRun();
  const mutation = run ? update : create;
  const { options: departments } = useDepartmentOptions();
  const [formError, setFormError] = useState<string>();
  const next = run ? monthOf(run.periodStart) : addMonths(monthOf(todayIso()), 1);
  const { register, control, handleSubmit, formState, setError } = useForm<RunFormValues>({
    resolver: zodResolver(runFormSchema),
    defaultValues: { month: next, paymentDate: run?.paymentDate ?? monthEnd(next), departmentId: run?.department?.id ?? '', currency: run?.currency ?? 'JOD', payFrequency: run?.payFrequency ?? 'monthly' },
  });
  const translate = (reason: string | undefined) => fieldErrorText(t, reason);
  const text = (name: Path<RunFormValues>, helper?: string) => textFieldProps(register, formState, name, translate, helper);
  const onSubmit = handleSubmit((v) => {
    setFormError(undefined);
    const input = toRunInput(runFormSchema.parse(v));
    const onError = (error: Error) => {
      // Period errors come back on `periodStart`; the form edits the month.
      const fields: Record<string, string[] | undefined> | null = isApiError(error) && error.fieldErrors ? { ...error.fieldErrors, ...(error.fieldErrors.periodStart ? { month: error.fieldErrors.periodStart } : {}) } : null;
      let applied = false;
      if (fields)
        for (const field of RUN_FIELDS)
          if (fields[field]?.[0]) {
            setError(field, { type: 'server', message: fields[field][0] }, { shouldFocus: !applied });
            applied = true;
          }
      if (!applied) setFormError(errorText(t, tCommon, error));
    };
    if (run) update.mutate({ id: run.id, input }, { onSuccess: onDone, onError });
    else create.mutate(input, { onSuccess: onDone, onError });
  });
  return (
    <FormDialog open title={run ? t('runs.editTitle') : t('runs.createTitle')} onClose={onClose} onSubmit={onSubmit} submitLabel={run ? t('actions.save') : t('actions.create')} pending={mutation.isPending} error={formError}>
      {run?.status === 'rejected' && <Alert severity="info">{t('runs.editRejectedHint')}</Alert>}
      <Box sx={{ display: 'grid', gap: 2.5, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}>
        <TextField label={t('fields.period')} type="month" required {...text('month', t('runs.monthHint'))} slotProps={ltr} />
        <TextField label={t('fields.paymentDate')} type="date" required {...text('paymentDate', t('runs.paymentHint'))} slotProps={ltr} />
        <SelectField
          control={control}
          name="departmentId"
          label={t('fields.departmentScope')}
          translate={translate}
          options={[{ value: '', label: t('common.allDepartments') }, ...departments.filter((d) => d.depth === 0).map((d) => ({ value: d.value, label: d.label, disabled: d.disabled }))]}
        />
        <SelectField control={control} name="currency" label={t('fields.currency')} translate={translate} options={CURRENCIES.map((c) => ({ value: c, label: c }))} />
        <SelectField control={control} name="payFrequency" label={t('fields.payFrequency')} translate={translate} helper={t('runs.frequencyHint')} options={PAY_FREQUENCIES.map((f) => ({ value: f, label: t(`payFrequency.${f}`) }))} />
      </Box>
    </FormDialog>
  );
}

/** Reject (approvers) or cancel (processors) a run: a reason is required and recorded in the history. */
export function ReasonDialog({ title, hint, submitLabel, pending, error, onSubmit, onClose }: { title: string; hint: string; submitLabel: string; pending: boolean; error?: string; onSubmit: (reason: string) => void; onClose: () => void }) {
  const { t } = useTranslation('payroll');
  const { register, handleSubmit, formState } = useForm<ReasonFormValues>({ resolver: zodResolver(reasonFormSchema), defaultValues: { reason: '' } });
  const translate = (reason: string | undefined) => fieldErrorText(t, reason);
  return (
    <FormDialog open title={title} onClose={onClose} onSubmit={handleSubmit((v) => onSubmit(v.reason.trim()))} submitLabel={submitLabel} pending={pending} error={error}>
      <Alert severity="info">{hint}</Alert>
      <TextField label={t('fields.reason')} required multiline minRows={3} {...textFieldProps(register, formState, 'reason', translate)} slotProps={{ htmlInput: { maxLength: 500 } }} />
    </FormDialog>
  );
}

/** Confirmation for a workflow step (approve, mark as paid, generate payslips). */
export function ActionDialog({ title, text, confirmLabel, pending, error, onConfirm, onClose }: { title: string; text: string; confirmLabel: string; pending: boolean; error?: string; onConfirm: () => void; onClose: () => void }) {
  const { t: tCommon } = useTranslation();
  const titleId = useId();
  const textId = useId();
  return (
    <Dialog open onClose={pending ? undefined : onClose} aria-labelledby={titleId} aria-describedby={textId} maxWidth="xs" fullWidth>
      <DialogTitle id={titleId}>{title}</DialogTitle>
      <DialogContent>
        <DialogContentText id={textId}>{text}</DialogContentText>
        {error && (
          <Alert severity="error" role="alert" sx={{ mt: 2 }}>
            {error}
          </Alert>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={pending}>
          {tCommon('actions.cancel')}
        </Button>
        <Button variant="contained" onClick={onConfirm} disabled={pending}>
          {confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
