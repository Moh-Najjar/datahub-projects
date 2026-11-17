import { useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Paper from '@mui/material/Paper';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import AddOutlined from '@mui/icons-material/AddOutlined';
import DeleteOutlined from '@mui/icons-material/DeleteOutlined';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useFieldArray, useForm, type Path } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '@/i18n/useLanguage';
import { FormDialog } from '@/modules/shared/FormDialog';
import { textFieldProps } from '@/modules/shared/formFields';
import { SelectField } from '@/modules/shared/SelectField';
import { applyServerErrors } from '@/modules/shared/utils/serverErrors';
import { useCreatePlan, useReviewCycles, useUpdatePlan } from '@/modules/performance/hooks/usePerformance';
import { planFormSchema, planToForm, toPlanInput, type PlanFormValues } from '@/modules/performance/schemas/performanceSchemas';
import { ACTIVITY_STATUSES, ACTIVITY_TYPES, PLAN_STATUSES, type DevelopmentPlan, type PlanStatus } from '@/modules/performance/types/performance';
import { addDays, todayIso } from '@/modules/performance/utils/rules';
import { errorText, fieldErrorText } from '@/modules/performance/utils/serverErrors';
import { EmployeeOptionPicker } from '../common/Fields';

const dateSlot = { inputLabel: { shrink: true }, htmlInput: { dir: 'ltr' } } as const;

/** Create / edit a lightweight development plan: objectives, learning activities with target dates, status. */
export function PlanFormDialog({ plan, employeeId, onClose, onDone }: { plan?: DevelopmentPlan; employeeId?: string; onClose: () => void; onDone: (p: DevelopmentPlan) => void }) {
  const { t } = useTranslation('performance');
  const { t: tCommon } = useTranslation();
  const { language } = useLanguage();
  const create = useCreatePlan();
  const update = useUpdatePlan();
  const mutation = plan ? update : create;
  const cycles = useReviewCycles({ page: 1, pageSize: 50, sortBy: 'startDate', sortDirection: 'desc' });
  const [formError, setFormError] = useState<string>();
  const target = addDays(todayIso(), 180);
  const defaults: PlanFormValues = plan
    ? planToForm({ ...plan, employeeId: plan.employee.id, cycleId: plan.cycle?.id ?? null })
    : planToForm({ employeeId: employeeId ?? '', title: '', objectives: [''], activities: [{ type: 'training', title: '', targetDate: addDays(todayIso(), 60), status: 'planned' }], targetDate: target, status: 'active', cycleId: null });
  const { register, control, handleSubmit, formState, setError } = useForm<PlanFormValues>({ resolver: zodResolver(planFormSchema), defaultValues: defaults });
  const objectives = useFieldArray({ control, name: 'objectives' });
  const activities = useFieldArray({ control, name: 'activities' });
  const translate = (reason: string | undefined) => fieldErrorText(t, reason);
  const text = (name: Path<PlanFormValues>, helper?: string) => textFieldProps(register, formState, name, translate, helper);
  const allowedStatuses: PlanStatus[] = plan ? (plan.status === 'draft' ? ['draft', 'active', 'cancelled'] : ['active', 'completed', 'cancelled']) : ['draft', 'active'];
  const fieldNames = ['employeeId', 'title', 'targetDate', 'status', 'cycleId', 'objectives', 'activities', ...activities.fields.map((_, i) => `activities.${i}.targetDate`)];

  const onSubmit = handleSubmit((v) => {
    setFormError(undefined);
    const input = toPlanInput(planFormSchema.parse(v));
    const callbacks = {
      onSuccess: onDone,
      onError: (error: Error) => {
        if (!applyServerErrors(error, fieldNames as Path<PlanFormValues>[], setError)) setFormError(errorText(t, tCommon, error));
      },
    };
    if (plan) update.mutate({ id: plan.id, input }, callbacks);
    else create.mutate(input, callbacks);
  });
  const listError = (name: 'objectives' | 'activities') => translate((formState.errors[name] as { message?: string } | undefined)?.message ?? (formState.errors[name] as { root?: { message?: string } } | undefined)?.root?.message);

  return (
    <FormDialog open maxWidth="md" title={plan ? t('plans.editTitle') : t('plans.createTitle')} onClose={onClose} onSubmit={onSubmit} submitLabel={plan ? t('actions.save') : t('actions.create')} pending={mutation.isPending} error={formError}>
      <Controller control={control} name="employeeId" render={({ field, fieldState }) => <EmployeeOptionPicker label={t('fields.employee')} value={field.value} onChange={field.onChange} error={translate(fieldState.error?.message)} known={plan?.employee} disabled={Boolean(plan || employeeId)} />} />
      <TextField label={t('fields.planTitle')} required {...text('title')} />
      <Box sx={{ display: 'grid', gap: 2.5, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr 1fr' } }}>
        <TextField label={t('fields.targetDate')} type="date" required {...text('targetDate')} slotProps={dateSlot} />
        <SelectField control={control} name="status" label={t('fields.status')} translate={translate} options={PLAN_STATUSES.filter((s) => allowedStatuses.includes(s) || s === plan?.status).map((s) => ({ value: s, label: t(`planStatus.${s}`) }))} />
        <Controller
          control={control}
          name="cycleId"
          render={({ field }) => (
            <TextField select label={t('fields.cycle')} value={field.value} onChange={field.onChange} slotProps={{ select: { native: true }, inputLabel: { shrink: true } }}>
              <option value="">{t('goals.noCycle')}</option>
              {(cycles.data?.items ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name[language]}
                </option>
              ))}
            </TextField>
          )}
        />
      </Box>
      <Box>
        <Typography variant="subtitle2" component="h3" sx={{ mb: 1 }}>
          {t('plans.objectives')}
        </Typography>
        <Box sx={{ display: 'grid', gap: 1.5 }}>
          {objectives.fields.map((f, i) => (
            <Box key={f.id} sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
              <TextField label={t('fields.objective', { index: i + 1 })} fullWidth {...text(`objectives.${i}.text`)} />
              <IconButton aria-label={t('plans.removeObjective', { index: i + 1 })} onClick={() => objectives.remove(i)} disabled={objectives.fields.length === 1}>
                <DeleteOutlined />
              </IconButton>
            </Box>
          ))}
        </Box>
        {listError('objectives') && <Typography color="error" variant="caption">{listError('objectives')}</Typography>}
        <Button size="small" startIcon={<AddOutlined />} onClick={() => objectives.append({ text: '' })} sx={{ mt: 1 }}>
          {t('plans.addObjective')}
        </Button>
      </Box>
      <Box>
        <Typography variant="subtitle2" component="h3" sx={{ mb: 1 }}>
          {t('plans.activities')}
        </Typography>
        <Box sx={{ display: 'grid', gap: 1.5 }}>
          {activities.fields.map((f, i) => (
            <Paper key={f.id} variant="outlined" sx={{ p: 1.5, display: 'grid', gap: 1.5, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}>
              <TextField label={t('fields.activity')} sx={{ gridColumn: { sm: '1 / -1' } }} {...text(`activities.${i}.title`)} />
              <SelectField control={control} name={`activities.${i}.type`} label={t('fields.activityType')} translate={translate} options={ACTIVITY_TYPES.map((x) => ({ value: x, label: t(`activityTypes.${x}`) }))} />
              <SelectField control={control} name={`activities.${i}.status`} label={t('fields.status')} translate={translate} options={ACTIVITY_STATUSES.map((x) => ({ value: x, label: t(`activityStatus.${x}`) }))} />
              <TextField label={t('fields.targetDate')} type="date" {...text(`activities.${i}.targetDate`)} slotProps={dateSlot} />
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
                <Button color="error" startIcon={<DeleteOutlined />} onClick={() => activities.remove(i)} disabled={activities.fields.length === 1}>
                  {t('plans.removeActivity')}
                </Button>
              </Box>
            </Paper>
          ))}
        </Box>
        {listError('activities') && <Typography color="error" variant="caption">{listError('activities')}</Typography>}
        <Button size="small" startIcon={<AddOutlined />} onClick={() => activities.append({ type: 'training', title: '', targetDate: addDays(todayIso(), 60), status: 'planned' })} sx={{ mt: 1 }}>
          {t('plans.addActivity')}
        </Button>
      </Box>
    </FormDialog>
  );
}
