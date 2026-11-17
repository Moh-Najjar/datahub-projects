import { useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import TextField from '@mui/material/TextField';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, type Path } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '@/i18n/useLanguage';
import { FormDialog } from '@/modules/shared/FormDialog';
import { arabicInput, latinInput, textFieldProps } from '@/modules/shared/formFields';
import { SelectField } from '@/modules/shared/SelectField';
import { applyServerErrors } from '@/modules/shared/utils/serverErrors';
import { useAssignParticipants, useCreateCycle, useReviewTemplates, useUpdateCycle, useUpdateCycleStatus } from '@/modules/performance/hooks/usePerformance';
import { cycleFormSchema, cycleToForm, toCycleInput, type CycleFormValues } from '@/modules/performance/schemas/performanceSchemas';
import type { CycleStatus, EmployeeOption, ReviewCycle } from '@/modules/performance/types/performance';
import { errorText, fieldErrorText } from '@/modules/performance/utils/serverErrors';
import { EmployeeMultiPicker } from '../common/Fields';

const FIELDS = ['nameEn', 'nameAr', 'description', 'startDate', 'endDate', 'periodStart', 'periodEnd', 'selfAssessmentDeadline', 'managerReviewDeadline', 'templateId'] as const;
const dateSlot = { inputLabel: { shrink: true }, htmlInput: { dir: 'ltr' } } as const;

/** Create / edit a draft review cycle (dates in order, no overlapping review periods — checked by the API too). */
export function CycleFormDialog({ cycle, onClose, onDone }: { cycle?: ReviewCycle; onClose: () => void; onDone: (c: ReviewCycle) => void }) {
  const { t } = useTranslation('performance');
  const { t: tCommon } = useTranslation();
  const { language } = useLanguage();
  const create = useCreateCycle();
  const update = useUpdateCycle();
  const mutation = cycle ? update : create;
  const templates = useReviewTemplates();
  const [formError, setFormError] = useState<string>();
  const { register, control, handleSubmit, formState, setError } = useForm<CycleFormValues>({
    resolver: zodResolver(cycleFormSchema),
    defaultValues: cycle ? cycleToForm({ ...cycle, templateId: cycle.template.id }) : cycleToForm({ name: { en: '', ar: '' }, description: '', templateId: 'tpl-01' } as never),
  });
  const translate = (reason: string | undefined) => fieldErrorText(t, reason);
  const text = (name: Path<CycleFormValues>, helper?: string) => textFieldProps(register, formState, name, translate, helper);
  const onSubmit = handleSubmit((v) => {
    setFormError(undefined);
    const input = toCycleInput(cycleFormSchema.parse(v));
    const callbacks = {
      onSuccess: onDone,
      onError: (error: Error) => {
        if (!applyServerErrors(error, FIELDS, setError)) setFormError(errorText(t, tCommon, error));
      },
    };
    if (cycle) update.mutate({ id: cycle.id, input }, callbacks);
    else create.mutate(input, callbacks);
  });
  const date = (name: Path<CycleFormValues>, label: string, helper?: string) => <TextField label={label} type="date" required {...text(name, helper)} slotProps={dateSlot} />;
  return (
    <FormDialog open maxWidth="md" title={cycle ? t('cycles.editTitle') : t('cycles.createTitle')} onClose={onClose} onSubmit={onSubmit} submitLabel={cycle ? t('actions.save') : t('actions.create')} pending={mutation.isPending} error={formError}>
      <Box sx={{ display: 'grid', gap: 2.5, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}>
        <TextField label={t('fields.nameEn')} required {...text('nameEn')} slotProps={latinInput} />
        <TextField label={t('fields.nameAr')} required {...text('nameAr')} slotProps={arabicInput} />
        {date('periodStart', t('fields.periodStart'), t('cycles.periodHint'))}
        {date('periodEnd', t('fields.periodEnd'))}
        {date('startDate', t('fields.startDate'))}
        {date('endDate', t('fields.endDate'))}
        {date('selfAssessmentDeadline', t('fields.selfAssessmentDeadline'))}
        {date('managerReviewDeadline', t('fields.managerReviewDeadline'))}
        <SelectField control={control} name="templateId" label={t('fields.template')} translate={translate} options={(templates.data ?? []).map((tp) => ({ value: tp.id, label: tp.name[language], disabled: tp.status !== 'active' }))} />
      </Box>
      <TextField label={t('fields.description')} multiline minRows={2} {...text('description')} />
    </FormDialog>
  );
}

/** Activate (creates every participant's review), or close (final; reviews stay readable). */
export function CycleStatusDialog({ cycle, status, onClose, onDone }: { cycle: ReviewCycle; status: CycleStatus; onClose: () => void; onDone: (c: ReviewCycle) => void }) {
  const { t } = useTranslation('performance');
  const { t: tCommon } = useTranslation();
  const { language } = useLanguage();
  const mutation = useUpdateCycleStatus();
  const [note, setNote] = useState('');
  return (
    <FormDialog
      open
      title={t('cycles.statusTitle', { action: t(`cycleActions.${status}`), name: cycle.name[language] })}
      onClose={onClose}
      onSubmit={(e) => {
        e.preventDefault();
        mutation.mutate({ id: cycle.id, status, note }, { onSuccess: onDone });
      }}
      submitLabel={t(`cycleActions.${status}`)}
      pending={mutation.isPending}
      error={mutation.isError ? errorText(t, tCommon, mutation.error) : undefined}
    >
      <Alert severity={status === 'closed' ? 'warning' : 'info'}>{t(`cycleStatusHints.${status}`)}</Alert>
      <TextField label={t('fields.note')} multiline minRows={2} value={note} onChange={(e) => setNote(e.target.value)} slotProps={{ htmlInput: { maxLength: 300 } }} />
    </FormDialog>
  );
}

/** Add participants (active employees). In an open cycle their reviews are created at once. */
export function AssignDialog({ cycle, onClose, onDone }: { cycle: ReviewCycle; onClose: () => void; onDone: (count: number) => void }) {
  const { t } = useTranslation('performance');
  const { t: tCommon } = useTranslation();
  const { language } = useLanguage();
  const mutation = useAssignParticipants();
  const [selected, setSelected] = useState<EmployeeOption[]>([]);
  return (
    <FormDialog
      open
      title={t('cycles.assignTitle', { name: cycle.name[language] })}
      onClose={onClose}
      onSubmit={(e) => {
        e.preventDefault();
        if (selected.length) mutation.mutate({ id: cycle.id, add: selected.map((s) => s.id), remove: [] }, { onSuccess: () => onDone(selected.length) });
      }}
      submitLabel={t('actions.assign')}
      pending={mutation.isPending}
      error={mutation.isError ? errorText(t, tCommon, mutation.error) : undefined}
    >
      <Alert severity="info">{cycle.status === 'draft' ? t('cycles.assignDraftHint') : t('cycles.assignOpenHint')}</Alert>
      <EmployeeMultiPicker label={t('fields.employees')} value={selected} onChange={setSelected} />
    </FormDialog>
  );
}
