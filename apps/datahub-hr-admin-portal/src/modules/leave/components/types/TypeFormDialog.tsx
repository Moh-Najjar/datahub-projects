import { useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm, useWatch, type Path } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { FormDialog } from '@/modules/shared/FormDialog';
import { arabicInput, latinInput, textFieldProps } from '@/modules/shared/formFields';
import { applyServerErrors } from '@/modules/shared/utils/serverErrors';
import { useCreateLeaveType, useUpdateLeaveType } from '@/modules/leave/hooks/useLeave';
import { leaveTypeFormSchema, leaveTypeToForm, toLeaveTypeInput, type LeaveTypeFormValues } from '@/modules/leave/schemas/leaveSchemas';
import type { LeaveType } from '@/modules/leave/types/leave';
import { errorText, fieldErrorText } from '@/modules/leave/utils/serverErrors';

const FIELDS = ['code', 'nameEn', 'nameAr', 'description', 'annualAllocation', 'seniorityYears', 'seniorityExtraDays', 'maxConsecutiveDays', 'eligibility'] as const;

const EMPTY: LeaveTypeFormValues = {
  code: '',
  nameEn: '',
  nameAr: '',
  description: '',
  paid: true,
  hasAllocation: true,
  annualAllocation: 0,
  seniorityYears: 0,
  seniorityExtraDays: 0,
  prorateFirstYear: false,
  hasMaxConsecutive: false,
  maxConsecutiveDays: undefined,
  requiresApproval: true,
  requiresDocument: false,
  eligibility: 'all',
  excludesPublicHolidays: true,
};

/** Create / edit a leave type. Its rules are configurable examples — not an official policy. */
export function TypeFormDialog({ leaveType, onClose, onDone }: { leaveType?: LeaveType; onClose: () => void; onDone: (t: LeaveType) => void }) {
  const { t } = useTranslation('leave');
  const { t: tCommon } = useTranslation();
  const create = useCreateLeaveType();
  const update = useUpdateLeaveType();
  const mutation = leaveType ? update : create;
  const [formError, setFormError] = useState<string>();
  const { register, control, handleSubmit, formState, setError } = useForm<LeaveTypeFormValues>({ resolver: zodResolver(leaveTypeFormSchema), defaultValues: leaveType ? leaveTypeToForm(leaveType) : EMPTY });
  const translate = (reason: string | undefined) => fieldErrorText(t, reason);
  const [hasAllocation, hasMax] = useWatch({ control, name: ['hasAllocation', 'hasMaxConsecutive'] });

  const onSubmit = handleSubmit((v) => {
    setFormError(undefined);
    const input = toLeaveTypeInput(leaveTypeFormSchema.parse(v));
    const callbacks = {
      onSuccess: onDone,
      onError: (error: unknown) => {
        if (!applyServerErrors(error, FIELDS, setError)) setFormError(errorText(t, tCommon, error));
      },
    };
    if (leaveType) update.mutate({ id: leaveType.id, input }, callbacks);
    else create.mutate(input, callbacks);
  });

  const check = (name: Path<LeaveTypeFormValues>, label: string) => (
    <Controller
      control={control}
      name={name}
      render={({ field }) => <FormControlLabel control={<Checkbox checked={Boolean(field.value)} onChange={(e) => field.onChange(e.target.checked)} onBlur={field.onBlur} />} label={label} />}
    />
  );
  const number = (name: 'annualAllocation' | 'seniorityYears' | 'seniorityExtraDays' | 'maxConsecutiveDays', label: string, helper?: string) => {
    const { ref, ...field } = register(name, { setValueAs: (v: unknown) => (v === '' || v === null || v === undefined ? undefined : Number(v)) });
    const message = formState.errors[name]?.message;
    const error = translate(typeof message === 'string' ? message : undefined);
    return <TextField type="number" label={label} {...field} inputRef={ref} error={Boolean(error)} helperText={error ?? helper} slotProps={{ htmlInput: { dir: 'ltr', min: 0, step: 1 } }} />;
  };

  return (
    <FormDialog open title={leaveType ? t('types.editTitle') : t('types.createTitle')} onClose={onClose} onSubmit={onSubmit} submitLabel={leaveType ? t('actions.save') : t('actions.create')} pending={mutation.isPending} error={formError}>
      <Alert severity="info">{t('types.policyNote')}</Alert>
      <TextField label={t('fields.code')} required {...textFieldProps(register, formState, 'code', translate, t('types.codeHint'))} slotProps={latinInput} />
      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}>
        <TextField label={t('fields.nameEn')} required {...textFieldProps(register, formState, 'nameEn', translate)} slotProps={latinInput} />
        <TextField label={t('fields.nameAr')} required {...textFieldProps(register, formState, 'nameAr', translate)} slotProps={arabicInput} />
      </Box>
      <TextField label={t('fields.description')} multiline minRows={2} {...textFieldProps(register, formState, 'description', translate)} />
      <Box sx={{ display: 'flex', flexWrap: 'wrap', columnGap: 2 }}>
        {check('paid', t('fields.paid'))}
        {check('requiresApproval', t('fields.requiresApproval'))}
        {check('requiresDocument', t('fields.requiresDocument'))}
        {check('excludesPublicHolidays', t('fields.excludesPublicHolidays'))}
      </Box>
      {check('hasAllocation', t('types.hasAllocation'))}
      {hasAllocation && (
        <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr 1fr' } }}>
          {number('annualAllocation', t('fields.annualAllocation'), t('types.daysPerYear'))}
          {number('seniorityYears', t('fields.seniorityYears'), t('types.seniorityYearsHint'))}
          {number('seniorityExtraDays', t('fields.seniorityExtraDays'))}
        </Box>
      )}
      {hasAllocation && check('prorateFirstYear', t('fields.prorateFirstYear'))}
      {check('hasMaxConsecutive', t('types.hasMaxConsecutive'))}
      {hasMax && number('maxConsecutiveDays', t('fields.maxConsecutiveDays'))}
      <Controller
        control={control}
        name="eligibility"
        render={({ field }) => (
          <TextField select label={t('fields.eligibility')} value={field.value} onChange={field.onChange} onBlur={field.onBlur} inputRef={field.ref} helperText={t('types.eligibilityHint')}>
            {(['all', 'female', 'male'] as const).map((e) => (
              <MenuItem key={e} value={e}>
                {t(`eligibility.${e}`)}
              </MenuItem>
            ))}
          </TextField>
        )}
      />
    </FormDialog>
  );
}
