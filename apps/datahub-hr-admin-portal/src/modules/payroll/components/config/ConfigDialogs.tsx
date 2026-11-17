import { useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Checkbox from '@mui/material/Checkbox';
import FormControl from '@mui/material/FormControl';
import FormControlLabel from '@mui/material/FormControlLabel';
import FormGroup from '@mui/material/FormGroup';
import FormHelperText from '@mui/material/FormHelperText';
import FormLabel from '@mui/material/FormLabel';
import Switch from '@mui/material/Switch';
import TextField from '@mui/material/TextField';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm, useWatch, type Path } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { FormDialog } from '@/modules/shared/FormDialog';
import { arabicInput, latinInput, textFieldProps } from '@/modules/shared/formFields';
import { SelectField } from '@/modules/shared/SelectField';
import { applyServerErrors } from '@/modules/shared/utils/serverErrors';
import {
  useCreateAllowanceType,
  useCreateDeductionType,
  useCreateStructure,
  useUpdateAllowanceType,
  useUpdateDeductionType,
  useUpdatePolicy,
  useUpdateStructure,
} from '@/modules/payroll/hooks/usePayroll';
import {
  allowanceTypeFormSchema,
  allowanceTypeToForm,
  deductionTypeFormSchema,
  deductionTypeToForm,
  policyFormSchema,
  structureFormSchema,
  structureToForm,
  toAllowanceTypeInput,
  toDeductionTypeInput,
  toStructureInput,
  type AllowanceTypeFormValues,
  type DeductionTypeFormValues,
  type PolicyFormValues,
  type StructureFormValues,
} from '@/modules/payroll/schemas/payrollSchemas';
import { CURRENCIES, DEDUCTION_CATEGORIES, EMPLOYMENT_TYPES, PAY_FREQUENCIES, SYSTEM_DEDUCTION_CATEGORIES, type AllowanceType, type DeductionType, type PayrollPolicy, type SalaryStructure } from '@/modules/payroll/types/payroll';
import { errorText, fieldErrorText } from '@/modules/payroll/utils/serverErrors';

const amountSlot = { htmlInput: { dir: 'ltr', inputMode: 'decimal' } } as const;

/* Salary structure ---------------------------------------------------------------------------------------------- */

const STRUCTURE_FIELDS = ['code', 'nameEn', 'nameAr', 'description', 'basicSalary', 'currency', 'payFrequency', 'employmentTypes'] as const;

export function StructureFormDialog({ structure, onClose, onDone }: { structure?: SalaryStructure; onClose: () => void; onDone: (s: SalaryStructure) => void }) {
  const { t } = useTranslation('payroll');
  const { t: tCommon } = useTranslation();
  const create = useCreateStructure();
  const update = useUpdateStructure();
  const mutation = structure ? update : create;
  const [formError, setFormError] = useState<string>();
  const { register, control, handleSubmit, formState, setError } = useForm<StructureFormValues>({ resolver: zodResolver(structureFormSchema), defaultValues: structureToForm(structure) });
  const currency = useWatch({ control, name: 'currency' });
  const translate = (reason: string | undefined) => fieldErrorText(t, reason);
  const text = (name: Path<StructureFormValues>, helper?: string) => textFieldProps(register, formState, name, translate, helper);
  const onSubmit = handleSubmit((v) => {
    setFormError(undefined);
    const input = toStructureInput(structureFormSchema.parse(v));
    const callbacks = {
      onSuccess: onDone,
      onError: (error: Error) => {
        if (!applyServerErrors(error, STRUCTURE_FIELDS, setError)) setFormError(errorText(t, tCommon, error));
      },
    };
    if (structure) update.mutate({ id: structure.id, input }, callbacks);
    else create.mutate(input, callbacks);
  });
  return (
    <FormDialog open title={structure ? t('structures.editTitle') : t('structures.createTitle')} onClose={onClose} onSubmit={onSubmit} submitLabel={structure ? t('actions.save') : t('actions.create')} pending={mutation.isPending} error={formError}>
      <Alert severity="info">{t('structures.formHint')}</Alert>
      <Box sx={{ display: 'grid', gap: 2.5, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}>
        <TextField label={t('fields.code')} required {...text('code', t('common.codeHint'))} slotProps={latinInput} />
        <SelectField control={control} name="currency" label={t('fields.currency')} translate={translate} options={CURRENCIES.map((c) => ({ value: c, label: c }))} />
        <TextField label={t('fields.nameEn')} required {...text('nameEn')} slotProps={latinInput} />
        <TextField label={t('fields.nameAr')} required {...text('nameAr')} slotProps={arabicInput} />
        <TextField label={t('fields.basicSalaryIn', { currency })} required {...text('basicSalary', t('structures.basicHint'))} slotProps={amountSlot} />
        <SelectField control={control} name="payFrequency" label={t('fields.payFrequency')} translate={translate} helper={t('runs.frequencyHint')} options={PAY_FREQUENCIES.map((f) => ({ value: f, label: t(`payFrequency.${f}`) }))} />
      </Box>
      <Controller
        control={control}
        name="employmentTypes"
        render={({ field, fieldState }) => (
          <FormControl component="fieldset" error={Boolean(fieldState.error)}>
            <FormLabel component="legend">{t('fields.employmentTypes')}</FormLabel>
            <FormGroup row>
              {EMPLOYMENT_TYPES.map((type) => (
                <FormControlLabel
                  key={type}
                  label={t(`employmentType.${type}`)}
                  control={<Checkbox checked={field.value.includes(type)} onChange={(e) => field.onChange(e.target.checked ? [...field.value, type] : field.value.filter((x) => x !== type))} />}
                />
              ))}
            </FormGroup>
            {fieldState.error && <FormHelperText>{translate(fieldState.error.message)}</FormHelperText>}
          </FormControl>
        )}
      />
      <TextField label={t('fields.description')} multiline minRows={2} {...text('description')} />
    </FormDialog>
  );
}

/* Allowance type ----------------------------------------------------------------------------------------------- */

const ALLOWANCE_FIELDS = ['code', 'nameEn', 'nameAr', 'description', 'calculation', 'amount', 'percentage', 'currency', 'recurrence'] as const;

export function AllowanceTypeDialog({ type, onClose, onDone }: { type?: AllowanceType; onClose: () => void; onDone: (a: AllowanceType) => void }) {
  const { t } = useTranslation('payroll');
  const { t: tCommon } = useTranslation();
  const create = useCreateAllowanceType();
  const update = useUpdateAllowanceType();
  const mutation = type ? update : create;
  const [formError, setFormError] = useState<string>();
  const { register, control, handleSubmit, formState, setError } = useForm<AllowanceTypeFormValues>({ resolver: zodResolver(allowanceTypeFormSchema), defaultValues: allowanceTypeToForm(type) });
  const [calculation, currency] = useWatch({ control, name: ['calculation', 'currency'] });
  const translate = (reason: string | undefined) => fieldErrorText(t, reason);
  const text = (name: Path<AllowanceTypeFormValues>, helper?: string) => textFieldProps(register, formState, name, translate, helper);
  const onSubmit = handleSubmit((v) => {
    setFormError(undefined);
    const input = toAllowanceTypeInput(allowanceTypeFormSchema.parse(v));
    const callbacks = {
      onSuccess: onDone,
      onError: (error: Error) => {
        if (!applyServerErrors(error, ALLOWANCE_FIELDS, setError)) setFormError(errorText(t, tCommon, error));
      },
    };
    if (type) update.mutate({ id: type.id, input }, callbacks);
    else create.mutate(input, callbacks);
  });
  return (
    <FormDialog open title={type ? t('allowances.editTitle') : t('allowances.createTitle')} onClose={onClose} onSubmit={onSubmit} submitLabel={type ? t('actions.save') : t('actions.create')} pending={mutation.isPending} error={formError}>
      {type && <Alert severity="info">{t('common.typeEditHint')}</Alert>}
      <Box sx={{ display: 'grid', gap: 2.5, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}>
        <TextField label={t('fields.code')} required {...text('code', t('common.codeHint'))} slotProps={latinInput} />
        <SelectField control={control} name="recurrence" label={t('fields.recurrence')} translate={translate} options={(['recurring', 'one-time'] as const).map((r) => ({ value: r, label: t(`recurrence.${r}`) }))} />
        <TextField label={t('fields.nameEn')} required {...text('nameEn')} slotProps={latinInput} />
        <TextField label={t('fields.nameAr')} required {...text('nameAr')} slotProps={arabicInput} />
        <SelectField control={control} name="calculation" label={t('fields.calculation')} translate={translate} options={(['fixed', 'percentage'] as const).map((c) => ({ value: c, label: t(`calculation.${c}`) }))} />
        {calculation === 'fixed' ? (
          <TextField label={t('fields.amountIn', { currency })} required {...text('amount')} slotProps={amountSlot} />
        ) : (
          <TextField label={t('fields.percentageOfBasic')} required {...text('percentage')} slotProps={amountSlot} />
        )}
        {calculation === 'fixed' && <SelectField control={control} name="currency" label={t('fields.currency')} translate={translate} options={CURRENCIES.map((c) => ({ value: c, label: c }))} />}
      </Box>
      <Controller control={control} name="taxable" render={({ field }) => <FormControlLabel control={<Switch checked={field.value} onChange={(e) => field.onChange(e.target.checked)} />} label={t('fields.taxableConfig')} />} />
      <FormHelperText sx={{ mt: -2 }}>{t('allowances.taxableHint')}</FormHelperText>
      <TextField label={t('fields.description')} multiline minRows={2} {...text('description')} />
    </FormDialog>
  );
}

/* Deduction type ----------------------------------------------------------------------------------------------- */

const DEDUCTION_FIELDS = ['code', 'nameEn', 'nameAr', 'description', 'category', 'calculation', 'amount', 'percentage', 'currency', 'recurrence', 'maxAmount'] as const;

export function DeductionTypeDialog({ type, onClose, onDone }: { type?: DeductionType; onClose: () => void; onDone: (d: DeductionType) => void }) {
  const { t } = useTranslation('payroll');
  const { t: tCommon } = useTranslation();
  const create = useCreateDeductionType();
  const update = useUpdateDeductionType();
  const mutation = type ? update : create;
  const [formError, setFormError] = useState<string>();
  const { register, control, handleSubmit, formState, setError, setValue } = useForm<DeductionTypeFormValues>({ resolver: zodResolver(deductionTypeFormSchema), defaultValues: deductionTypeToForm(type) });
  const [category, calculation, currency] = useWatch({ control, name: ['category', 'calculation', 'currency'] });
  const system = SYSTEM_DEDUCTION_CATEGORIES.includes(category);
  const translate = (reason: string | undefined) => fieldErrorText(t, reason);
  const text = (name: Path<DeductionTypeFormValues>, helper?: string) => textFieldProps(register, formState, name, translate, helper);
  const onSubmit = handleSubmit((v) => {
    setFormError(undefined);
    const input = toDeductionTypeInput(deductionTypeFormSchema.parse(v));
    const callbacks = {
      onSuccess: onDone,
      onError: (error: Error) => {
        if (!applyServerErrors(error, DEDUCTION_FIELDS, setError)) setFormError(errorText(t, tCommon, error));
      },
    };
    if (type) update.mutate({ id: type.id, input }, callbacks);
    else create.mutate(input, callbacks);
  });
  return (
    <FormDialog open title={type ? t('deductions.editTitle') : t('deductions.createTitle')} onClose={onClose} onSubmit={onSubmit} submitLabel={type ? t('actions.save') : t('actions.create')} pending={mutation.isPending} error={formError}>
      {category === 'statutory' && <Alert severity="warning">{t('deductions.statutoryWarning')}</Alert>}
      {system && <Alert severity="info">{t('deductions.systemHint')}</Alert>}
      {!type && (category === 'statutory' || system) && <Alert severity="info">{t('deductions.startsInactive')}</Alert>}
      <Box sx={{ display: 'grid', gap: 2.5, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}>
        <TextField label={t('fields.code')} required {...text('code', t('common.codeHint'))} slotProps={latinInput} />
        <SelectField
          control={control}
          name="category"
          label={t('fields.category')}
          translate={translate}
          disabled={Boolean(type)}
          helper={type ? t('deductions.categoryLocked') : undefined}
          onChange={(c) => setValue('calculation', SYSTEM_DEDUCTION_CATEGORIES.includes(c as never) ? 'daily-rate' : calculation === 'daily-rate' ? 'fixed' : calculation)}
          options={DEDUCTION_CATEGORIES.map((c) => ({ value: c, label: t(`deductionCategory.${c}`) }))}
        />
        <TextField label={t('fields.nameEn')} required {...text('nameEn')} slotProps={latinInput} />
        <TextField label={t('fields.nameAr')} required {...text('nameAr')} slotProps={arabicInput} />
        <SelectField
          control={control}
          name="calculation"
          label={t('fields.calculation')}
          translate={translate}
          disabled={system}
          options={(system ? (['daily-rate'] as const) : (['fixed', 'percentage'] as const)).map((c) => ({ value: c, label: t(`calculation.${c}`) }))}
        />
        {calculation === 'fixed' && <TextField label={t('fields.amountIn', { currency })} required {...text('amount')} slotProps={amountSlot} />}
        {calculation === 'percentage' && <TextField label={t('fields.percentageOfBasic')} required {...text('percentage')} slotProps={amountSlot} />}
        {!system && <SelectField control={control} name="recurrence" label={t('fields.recurrence')} translate={translate} options={(['recurring', 'one-time'] as const).map((r) => ({ value: r, label: t(`recurrence.${r}`) }))} />}
        <TextField label={t('fields.maxAmountIn', { currency })} {...text('maxAmount', t('deductions.maxHint'))} slotProps={amountSlot} />
        <SelectField control={control} name="currency" label={t('fields.currency')} translate={translate} options={CURRENCIES.map((c) => ({ value: c, label: c }))} />
      </Box>
      <TextField label={t('fields.description')} multiline minRows={2} {...text('description')} />
    </FormDialog>
  );
}

/* Calculation policy ------------------------------------------------------------------------------------------- */

export function PolicyDialog({ policy, onClose, onDone }: { policy: PayrollPolicy; onClose: () => void; onDone: () => void }) {
  const { t } = useTranslation('payroll');
  const { t: tCommon } = useTranslation();
  const mutation = useUpdatePolicy();
  const { register, handleSubmit, formState, setError } = useForm<PolicyFormValues>({ resolver: zodResolver(policyFormSchema), defaultValues: { dailyRateDivisor: String(policy.dailyRateDivisor) } });
  const translate = (reason: string | undefined) => fieldErrorText(t, reason);
  const [formError, setFormError] = useState<string>();
  return (
    <FormDialog
      open
      title={t('policy.editTitle')}
      onClose={onClose}
      onSubmit={handleSubmit((v) =>
        mutation.mutate(
          { dailyRateDivisor: Number(v.dailyRateDivisor) },
          {
            onSuccess: onDone,
            onError: (error) => {
              if (!applyServerErrors(error, ['dailyRateDivisor'], setError)) setFormError(errorText(t, tCommon, error));
            },
          },
        ),
      )}
      submitLabel={t('actions.save')}
      pending={mutation.isPending}
      error={formError}
    >
      <Alert severity="info">{t('policy.editHint')}</Alert>
      <TextField label={t('fields.dailyRateDivisor')} required {...textFieldProps(register, formState, 'dailyRateDivisor', translate, t('policy.divisorHint'))} slotProps={{ htmlInput: { dir: 'ltr', inputMode: 'numeric' } }} />
    </FormDialog>
  );
}
