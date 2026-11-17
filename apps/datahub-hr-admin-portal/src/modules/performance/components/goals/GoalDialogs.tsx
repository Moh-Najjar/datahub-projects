import { useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import FormControlLabel from '@mui/material/FormControlLabel';
import MenuItem from '@mui/material/MenuItem';
import Radio from '@mui/material/Radio';
import RadioGroup from '@mui/material/RadioGroup';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm, useWatch, type Path } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '@/i18n/useLanguage';
import { useDepartmentOptions } from '@/modules/organization';
import { FormDialog } from '@/modules/shared/FormDialog';
import { textFieldProps } from '@/modules/shared/formFields';
import { SelectField } from '@/modules/shared/SelectField';
import { applyServerErrors } from '@/modules/shared/utils/serverErrors';
import { usePerformanceAccess } from '@/modules/performance/hooks/usePerformanceAccess';
import { useCreateGoal, useReviewCycles, useUpdateGoal, useUpdateGoalProgress } from '@/modules/performance/hooks/usePerformance';
import { goalFormSchema, goalToForm, progressFormSchema, toGoalInput, type GoalFormValues, type ProgressFormValues } from '@/modules/performance/schemas/performanceSchemas';
import { GOAL_CATEGORIES, GOAL_STATUSES, PRIORITIES, type Goal } from '@/modules/performance/types/performance';
import { formatTimestamp } from '@/modules/performance/utils/format';
import { addDays, todayIso } from '@/modules/performance/utils/rules';
import { errorText, fieldErrorText } from '@/modules/performance/utils/serverErrors';
import { EmployeeOptionPicker } from '../common/Fields';

const GOAL_FIELDS = ['title', 'description', 'category', 'ownerType', 'employeeId', 'departmentId', 'cycleId', 'startDate', 'dueDate', 'target', 'priority'] as const;
const dateSlot = { inputLabel: { shrink: true }, htmlInput: { dir: 'ltr' } } as const;

/** Create / edit a measurable goal for an employee (or a department) the caller manages. */
export function GoalFormDialog({ goal, employeeId, onClose, onDone }: { goal?: Goal; employeeId?: string; onClose: () => void; onDone: (g: Goal) => void }) {
  const { t } = useTranslation('performance');
  const { t: tCommon } = useTranslation();
  const { language } = useLanguage();
  const { canReadOrganization, scope } = usePerformanceAccess();
  const create = useCreateGoal();
  const update = useUpdateGoal();
  const mutation = goal ? update : create;
  const [formError, setFormError] = useState<string>();
  const cycles = useReviewCycles({ page: 1, pageSize: 50, sortBy: 'startDate', sortDirection: 'desc' });
  const { options: departments } = useDepartmentOptions({ enabled: canReadOrganization });
  const defaults: GoalFormValues = goal
    ? goalToForm({ ...goal, ownerType: goal.owner ? 'employee' : 'department', employeeId: goal.owner?.id ?? null, departmentId: goal.department.id, cycleId: goal.cycle?.id ?? null })
    : goalToForm({ title: '', description: '', category: 'business', ownerType: 'employee', employeeId: employeeId ?? null, departmentId: '', cycleId: null, startDate: todayIso(), dueDate: addDays(todayIso(), 90), target: '', priority: 'medium' });
  const { register, control, handleSubmit, formState, setError } = useForm<GoalFormValues>({ resolver: zodResolver(goalFormSchema), defaultValues: defaults });
  const ownerType = useWatch({ control, name: 'ownerType' });
  const translate = (reason: string | undefined) => fieldErrorText(t, reason);
  const text = (name: Path<GoalFormValues>, helper?: string) => textFieldProps(register, formState, name, translate, helper);
  const openCycles = (cycles.data?.items ?? []).filter((c) => c.status !== 'closed' && c.status !== 'completed');
  // Department goals: organization roles pick from the hierarchy; team managers from their own departments.
  const departmentChoices = canReadOrganization ? departments.map((d) => ({ value: d.value, label: `${'— '.repeat(d.depth)}${d.label}`, disabled: d.disabled })) : [];

  const onSubmit = handleSubmit((v) => {
    setFormError(undefined);
    const input = toGoalInput(goalFormSchema.parse(v));
    const callbacks = {
      onSuccess: onDone,
      onError: (error: Error) => {
        if (!applyServerErrors(error, GOAL_FIELDS, setError)) setFormError(errorText(t, tCommon, error));
      },
    };
    if (goal) update.mutate({ id: goal.id, input }, callbacks);
    else create.mutate(input, callbacks);
  });

  return (
    <FormDialog open maxWidth="md" title={goal ? t('goals.editTitle') : t('goals.createTitle')} onClose={onClose} onSubmit={onSubmit} submitLabel={goal ? t('actions.save') : t('actions.create')} pending={mutation.isPending} error={formError}>
      {scope.kind === 'organization' && (
        <Controller
          control={control}
          name="ownerType"
          render={({ field }) => (
            <RadioGroup row value={field.value} onChange={(e) => field.onChange(e.target.value)} aria-label={t('fields.ownerType')}>
              <FormControlLabel value="employee" control={<Radio />} label={t('goals.employeeGoal')} />
              <FormControlLabel value="department" control={<Radio />} label={t('goals.departmentGoal')} disabled={!canReadOrganization} />
            </RadioGroup>
          )}
        />
      )}
      {ownerType === 'employee' ? (
        <Controller control={control} name="employeeId" render={({ field, fieldState }) => <EmployeeOptionPicker label={t('fields.owner')} value={field.value} onChange={field.onChange} error={translate(fieldState.error?.message)} known={goal?.owner} disabled={Boolean(employeeId)} />} />
      ) : (
        <SelectField control={control} name="departmentId" label={t('fields.department')} translate={translate} options={departmentChoices} />
      )}
      <TextField label={t('fields.goalTitle')} required {...text('title')} />
      <TextField label={t('fields.target')} required {...text('target', t('goals.targetHint'))} />
      <TextField label={t('fields.description')} multiline minRows={2} {...text('description')} />
      <Box sx={{ display: 'grid', gap: 2.5, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}>
        <SelectField control={control} name="category" label={t('fields.category')} translate={translate} options={GOAL_CATEGORIES.map((c) => ({ value: c, label: t(`categories.${c}`) }))} />
        <SelectField control={control} name="priority" label={t('fields.priority')} translate={translate} options={PRIORITIES.map((p) => ({ value: p, label: t(`priorities.${p}`) }))} />
        <TextField label={t('fields.startDate')} type="date" required {...text('startDate')} slotProps={dateSlot} />
        <TextField label={t('fields.dueDate')} type="date" required {...text('dueDate')} slotProps={dateSlot} />
        <Controller
          control={control}
          name="cycleId"
          render={({ field, fieldState }) => (
            <TextField select label={t('fields.cycle')} value={field.value} onChange={field.onChange} onBlur={field.onBlur} inputRef={field.ref} error={Boolean(fieldState.error)} helperText={translate(fieldState.error?.message) ?? t('goals.cycleHint')} slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }}>
              <MenuItem value="">{t('goals.noCycle')}</MenuItem>
              {openCycles.map((c) => (
                <MenuItem key={c.id} value={c.id}>
                  {c.name[language]}
                </MenuItem>
              ))}
            </TextField>
          )}
        />
      </Box>
    </FormDialog>
  );
}

/** Update progress (0–100) and status, with a note recorded in the goal's history. */
export function GoalProgressDialog({ goal, onClose, onDone }: { goal: Goal; onClose: () => void; onDone: (g: Goal) => void }) {
  const { t } = useTranslation('performance');
  const { t: tCommon } = useTranslation();
  const mutation = useUpdateGoalProgress();
  const [formError, setFormError] = useState<string>();
  const { register, control, handleSubmit, formState, setError } = useForm<ProgressFormValues>({ resolver: zodResolver(progressFormSchema), defaultValues: { progress: goal.progress, status: goal.status, note: '' } });
  const translate = (reason: string | undefined) => fieldErrorText(t, reason);
  const progress = register('progress', { setValueAs: (v: unknown) => (v === '' ? undefined : Number(v)) });
  const progressError = translate(formState.errors.progress?.message);
  const onSubmit = handleSubmit((v) =>
    mutation.mutate(
      { id: goal.id, input: progressFormSchema.parse(v) },
      {
        onSuccess: onDone,
        onError: (error) => {
          if (!applyServerErrors(error, ['progress', 'status', 'note'], setError)) setFormError(errorText(t, tCommon, error));
        },
      },
    ),
  );
  return (
    <FormDialog open title={t('goals.progressTitle', { title: goal.title })} onClose={onClose} onSubmit={onSubmit} submitLabel={t('actions.save')} pending={mutation.isPending} error={formError}>
      <Typography variant="body2" color="text.secondary">
        {t('fields.target')}: {goal.target}
      </Typography>
      <TextField type="number" label={t('fields.progress')} required {...progress} inputRef={progress.ref} error={Boolean(progressError)} helperText={progressError ?? t('goals.progressHint')} slotProps={{ htmlInput: { dir: 'ltr', min: 0, max: 100, step: 5 } }} />
      <SelectField control={control} name="status" label={t('fields.status')} translate={translate} options={GOAL_STATUSES.map((s) => ({ value: s, label: t(`goalStatus.${s}`) }))} />
      <TextField label={t('fields.note')} multiline minRows={2} {...textFieldProps(register, formState, 'note', translate)} />
      <Alert severity="info">{t('goals.finalNote')}</Alert>
    </FormDialog>
  );
}

/** The goal's history: creation, edits, progress and status changes. */
export function GoalHistoryDialog({ goal, onClose }: { goal: Goal; onClose: () => void }) {
  const { t } = useTranslation('performance');
  const { language } = useLanguage();
  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="sm" aria-labelledby="goal-history-title">
      <DialogTitle id="goal-history-title">{t('goals.historyTitle', { title: goal.title })}</DialogTitle>
      <DialogContent dividers>
        <Box component="ol" sx={{ listStyle: 'none', m: 0, p: 0, display: 'grid', gap: 1.5 }} aria-label={t('goals.history')}>
          {[...goal.history].reverse().map((h, i) => (
            <Box component="li" key={`${h.at}-${i}`}>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                {h.type === 'progress' ? t('goals.events.progress', { from: h.from, to: h.to }) : h.type === 'status' ? t('goals.events.status', { from: t(`goalStatus.${h.from as 'in-progress'}`), to: t(`goalStatus.${h.to as 'in-progress'}`) }) : t(`goals.events.${h.type}`)}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {h.by[language]} · {formatTimestamp(h.at, language)}
                {h.note ? ` · ${h.note}` : ''}
              </Typography>
            </Box>
          ))}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('actions.close')}</Button>
      </DialogActions>
    </Dialog>
  );
}
