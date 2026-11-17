import { useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import TextField from '@mui/material/TextField';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, useWatch, type Path } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '@/i18n/useLanguage';
import { FormDialog } from '@/modules/shared/FormDialog';
import { textFieldProps } from '@/modules/shared/formFields';
import { SelectField } from '@/modules/shared/SelectField';
import { applyServerErrors } from '@/modules/shared/utils/serverErrors';
import { useAllowanceTypes, useAssignAllowance, useAssignDeduction, useDeductionTypes, useEndAssignment, useSalaryStructures, useUpdateCompensation } from '@/modules/payroll/hooks/usePayroll';
import { assignmentFormSchema, compensationFormSchema, toAssignmentInput, toCompensationInput, type AssignmentFormValues, type CompensationFormValues } from '@/modules/payroll/schemas/payrollSchemas';
import { COMPENSATION_REASONS, SYSTEM_DEDUCTION_CATEGORIES, type EmployeeAllowance, type EmployeeCompensationDetail, type EmployeeDeduction } from '@/modules/payroll/types/payroll';
import { toDecimalString } from '@/modules/payroll/utils/money';
import { percentText } from '@/modules/payroll/utils/money';
import { addDays, todayIso } from '@/modules/payroll/utils/rules';
import { errorText, fieldErrorText } from '@/modules/payroll/utils/serverErrors';

const ltr = { inputLabel: { shrink: true }, htmlInput: { dir: 'ltr' } } as const;
const amountSlot = { htmlInput: { dir: 'ltr', inputMode: 'decimal' } } as const;
const COMP_FIELDS = ['structureId', 'basicSalary', 'effectiveFrom', 'reason', 'note'] as const;

/** New salary record from an effective date (assigning a structure is the same operation). History is never edited. */
export function CompensationFormDialog({ detail, onClose, onDone }: { detail: EmployeeCompensationDetail; onClose: () => void; onDone: () => void }) {
  const { t } = useTranslation('payroll');
  const { t: tCommon } = useTranslation();
  const { language } = useLanguage();
  const mutation = useUpdateCompensation();
  const structures = useSalaryStructures({ page: 1, pageSize: 100, sortBy: 'code', sortDirection: 'asc' });
  const [formError, setFormError] = useState<string>();
  const current = detail.current;
  const latest = detail.history[0];
  const { register, control, handleSubmit, formState, setError, setValue } = useForm<CompensationFormValues>({
    resolver: zodResolver(compensationFormSchema),
    defaultValues: {
      structureId: current?.structure.id ?? '',
      currency: current?.currency ?? 'JOD',
      basicSalary: current ? toDecimalString(current.basicSalary, current.currency) : '',
      effectiveFrom: latest && latest.effectiveFrom >= todayIso() ? addDays(latest.effectiveFrom, 1) : addDays(todayIso(), 1),
      reason: current ? 'annual-review' : 'hire',
      note: '',
    },
  });
  const currency = useWatch({ control, name: 'currency' });
  const translate = (reason: string | undefined) => fieldErrorText(t, reason);
  const text = (name: Path<CompensationFormValues>, helper?: string) => textFieldProps(register, formState, name, translate, helper);
  const items = structures.data?.items ?? [];
  const onSubmit = handleSubmit((v) => {
    setFormError(undefined);
    mutation.mutate(
      { employeeId: detail.employeeId, input: toCompensationInput(compensationFormSchema.parse(v)) },
      {
        onSuccess: onDone,
        onError: (error) => {
          if (!applyServerErrors(error, COMP_FIELDS, setError)) setFormError(errorText(t, tCommon, error));
        },
      },
    );
  });
  return (
    <FormDialog open title={current ? t('compensation.updateTitle') : t('compensation.setTitle')} onClose={onClose} onSubmit={onSubmit} submitLabel={t('actions.save')} pending={mutation.isPending} error={formError}>
      <Alert severity="info">{t('compensation.historyHint')}</Alert>
      <SelectField
        control={control}
        name="structureId"
        label={t('fields.structure')}
        translate={translate}
        onChange={(id) => {
          const s = items.find((x) => x.id === id);
          if (!s) return;
          setValue('currency', s.currency);
          if (!current) setValue('basicSalary', toDecimalString(s.basicSalary, s.currency));
        }}
        options={items.map((s) => ({ value: s.id, label: `${s.code} — ${s.name[language]} (${s.currency})`, disabled: s.status !== 'active' || !s.employmentTypes.includes(detail.employee.employmentType) }))}
        helper={t('compensation.structureHint', { type: t(`employmentType.${detail.employee.employmentType}`) })}
      />
      <Box sx={{ display: 'grid', gap: 2.5, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}>
        <TextField label={t('fields.basicSalaryIn', { currency })} required {...text('basicSalary', t('compensation.amountHint'))} slotProps={amountSlot} />
        <TextField label={t('fields.effectiveFrom')} type="date" required {...text('effectiveFrom', t('compensation.effectiveHint'))} slotProps={ltr} />
      </Box>
      <SelectField control={control} name="reason" label={t('fields.reason')} translate={translate} options={COMPENSATION_REASONS.map((r) => ({ value: r, label: t(`compensationReason.${r}`) }))} />
      <TextField label={t('fields.note')} multiline minRows={2} {...text('note')} slotProps={{ htmlInput: { maxLength: 500 } }} />
    </FormDialog>
  );
}

const ASSIGN_FIELDS = ['typeId', 'amount', 'percentage', 'effectiveFrom', 'effectiveTo', 'note'] as const;

/** Assign an allowance or a deduction type to the employee, with its amount (default from the type) and dates. */
export function AssignmentDialog({ kind, employeeId, onClose, onDone }: { kind: 'allowance' | 'deduction'; employeeId: string; onClose: () => void; onDone: () => void }) {
  const { t } = useTranslation('payroll');
  const { t: tCommon } = useTranslation();
  const { language } = useLanguage();
  const allowances = useAllowanceTypes({ page: 1, pageSize: 100, sortBy: 'code', filters: { status: 'active' } }, kind === 'allowance');
  const deductions = useDeductionTypes({ page: 1, pageSize: 100, sortBy: 'code', filters: { status: 'active' } }, kind === 'deduction');
  const assignAllowance = useAssignAllowance();
  const assignDeduction = useAssignDeduction();
  const mutation = kind === 'allowance' ? assignAllowance : assignDeduction;
  const types = kind === 'allowance' ? (allowances.data?.items ?? []) : (deductions.data?.items ?? []).filter((d) => !SYSTEM_DEDUCTION_CATEGORIES.includes(d.category) && d.category !== 'statutory');
  const [formError, setFormError] = useState<string>();
  const { register, control, handleSubmit, formState, setError, setValue } = useForm<AssignmentFormValues>({
    resolver: zodResolver(assignmentFormSchema),
    defaultValues: { typeId: '', calculation: 'fixed', currency: 'JOD', recurrence: 'recurring', amount: '', percentage: '', effectiveFrom: addDays(todayIso(), 1), effectiveTo: '', note: '' },
  });
  const [calculation, currency, recurrence] = useWatch({ control, name: ['calculation', 'currency', 'recurrence'] });
  const translate = (reason: string | undefined) => fieldErrorText(t, reason);
  const text = (name: Path<AssignmentFormValues>, helper?: string) => textFieldProps(register, formState, name, translate, helper);
  const onSubmit = handleSubmit((v) => {
    setFormError(undefined);
    mutation.mutate(
      { employeeId, input: toAssignmentInput(assignmentFormSchema.parse(v)) },
      {
        onSuccess: onDone,
        onError: (error) => {
          if (!applyServerErrors(error, ASSIGN_FIELDS, setError)) setFormError(errorText(t, tCommon, error));
        },
      },
    );
  });
  return (
    <FormDialog open title={kind === 'allowance' ? t('compensation.assignAllowance') : t('compensation.assignDeduction')} onClose={onClose} onSubmit={onSubmit} submitLabel={t('actions.assign')} pending={mutation.isPending} error={formError}>
      <SelectField
        control={control}
        name="typeId"
        label={kind === 'allowance' ? t('fields.allowanceType') : t('fields.deductionType')}
        translate={translate}
        onChange={(id) => {
          const type = types.find((x) => x.id === id);
          if (!type) return;
          setValue('calculation', type.calculation === 'percentage' ? 'percentage' : 'fixed');
          setValue('currency', type.currency);
          setValue('recurrence', type.recurrence);
          setValue('amount', type.amount !== null ? toDecimalString(type.amount, type.currency) : '');
          setValue('percentage', type.percentage !== null ? percentText(type.percentage) : '');
        }}
        options={types.map((x) => ({ value: x.id, label: `${x.code} — ${x.name[language]}` }))}
      />
      <Box sx={{ display: 'grid', gap: 2.5, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}>
        {calculation === 'fixed' ? (
          <TextField label={t('fields.amountIn', { currency })} required {...text('amount', recurrence === 'one-time' ? t('compensation.oneTimeHint') : t('compensation.perPeriodHint'))} slotProps={amountSlot} />
        ) : (
          <TextField label={t('fields.percentageOfBasic')} required {...text('percentage')} slotProps={amountSlot} />
        )}
        <TextField label={t('fields.effectiveFrom')} type="date" required {...text('effectiveFrom')} slotProps={ltr} />
        {recurrence === 'recurring' && <TextField label={t('fields.effectiveTo')} type="date" {...text('effectiveTo', t('compensation.openEndedHint'))} slotProps={ltr} />}
      </Box>
      <TextField label={t('fields.note')} {...text('note')} slotProps={{ htmlInput: { maxLength: 300 } }} />
    </FormDialog>
  );
}

/** Ends a recurring assignment on a date (the record and its history stay). */
export function EndAssignmentDialog({ assignment, onClose, onDone }: { assignment: EmployeeAllowance | EmployeeDeduction; onClose: () => void; onDone: () => void }) {
  const { t } = useTranslation('payroll');
  const { t: tCommon } = useTranslation();
  const { language } = useLanguage();
  const mutation = useEndAssignment();
  const [endDate, setEndDate] = useState(todayIso() > assignment.effectiveFrom ? todayIso() : assignment.effectiveFrom);
  const [note, setNote] = useState('');
  const reason = mutation.error && 'fieldErrors' in mutation.error ? (mutation.error as { fieldErrors?: Record<string, string[]> }).fieldErrors?.endDate?.[0] : undefined;
  return (
    <FormDialog
      open
      title={t('compensation.endTitle', { name: assignment.type.name[language] })}
      onClose={onClose}
      onSubmit={(e) => {
        e.preventDefault();
        mutation.mutate({ id: assignment.id, endDate, note }, { onSuccess: onDone });
      }}
      submitLabel={t('actions.end')}
      pending={mutation.isPending}
      error={mutation.isError && !reason ? errorText(t, tCommon, mutation.error) : undefined}
    >
      <TextField label={t('fields.endDate')} type="date" required value={endDate} onChange={(e) => setEndDate(e.target.value)} error={Boolean(reason)} helperText={reason ? fieldErrorText(t, reason) : t('compensation.endHint')} slotProps={ltr} />
      <TextField label={t('fields.note')} value={note} onChange={(e) => setNote(e.target.value)} slotProps={{ htmlInput: { maxLength: 300 } }} />
    </FormDialog>
  );
}
