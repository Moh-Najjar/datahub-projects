import { useEffect, useState } from 'react';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { TRAINING_STATUSES } from '@/core/domain/training';
import { useAuth } from '@/core/auth/authContext';
import { isDepartmentScoped } from '@/core/auth/trainingPolicy';
import { useT } from '@/i18n/useT';
import { useDepartmentOptions } from '@/modules/departments';
import { FormDialog } from '@/modules/shared/FormDialog';
import { SelectField } from '@/modules/shared/SelectField';
import { applyServerErrors } from '@/modules/shared/utils/apiMessage';
import { useCreateTraining, useUpdateTraining } from '../hooks/useTrainings';
import { trainingSchema, type TrainingFormValues } from '../schemas/trainingSchemas';
import type { TrainingDto } from '../types/training';

interface TrainingFormDialogProps {
  /** null = create a new training. */
  training: TrainingDto | null;
  onClose: () => void;
  onSaved: (training: TrainingDto, created: boolean) => void;
}

const toDuration = (value: string): number | null => (value.trim() === '' ? null : Number(value));

/** Create / edit a training: title, description, department (create), status (edit), optional dates and duration. */
export function TrainingFormDialog({ training, onClose, onSaved }: TrainingFormDialogProps) {
  const t = useT();
  const { actor } = useAuth();
  const scoped = actor ? isDepartmentScoped(actor) : false;
  const departments = useDepartmentOptions();
  const create = useCreateTraining();
  const update = useUpdateTraining();
  const [failure, setFailure] = useState<unknown>(null);
  const { register, control, handleSubmit, setError, setFocus, formState: { errors, isSubmitting } } = useForm<TrainingFormValues>({
    resolver: zodResolver(trainingSchema(t)),
    defaultValues: {
      title: training?.title ?? '',
      description: training?.description ?? '',
      departmentId: training?.departmentId ?? (scoped ? (actor?.departmentId ?? '') : ''),
      status: training?.status ?? 'draft',
      startDate: training?.startDate ?? '',
      endDate: training?.endDate ?? '',
      durationHours: training?.durationHours != null ? String(training.durationHours) : '',
    },
  });

  useEffect(() => setFocus('title'), [setFocus]);

  const submit = handleSubmit(async (values) => {
    setFailure(null);
    const common = { title: values.title, description: values.description, startDate: values.startDate || null, endDate: values.endDate || null, durationHours: toDuration(values.durationHours) };
    try {
      const saved = training ? await update.mutateAsync({ id: training.id, input: { ...common, status: values.status } }) : await create.mutateAsync({ ...common, departmentId: values.departmentId });
      onSaved(saved, !training);
      onClose();
    } catch (error) {
      if (!applyServerErrors(t, error, setError, ['title', 'description', 'departmentId', 'status', 'startDate', 'endDate', 'durationHours'])) setFailure(error);
    }
  });

  return (
    <FormDialog open title={training ? t.trainings.edit : t.trainings.new} submitLabel={training ? t.common.save : t.common.create} isSubmitting={isSubmitting} error={failure} onClose={onClose} onSubmit={submit} maxWidth="md">
      <Stack spacing={2.5} sx={{ pt: 1 }}>
        <TextField label={t.trainings.fields.title} required autoComplete="off" error={!!errors.title} helperText={errors.title?.message} {...register('title')} slotProps={{ inputLabel: { shrink: true } }} />
        <TextField label={t.trainings.fields.description} required multiline minRows={4} error={!!errors.description} helperText={errors.description?.message} {...register('description')} slotProps={{ inputLabel: { shrink: true } }} />
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2.5}>
          {!training && (
            <SelectField control={control} name="departmentId" label={t.trainings.fields.department} required disabled={scoped} emptyLabel={t.trainings.selectDepartment} options={(departments.data ?? []).map((d) => ({ value: d.id, label: d.name }))} helperText={scoped ? t.trainings.departmentLocked : undefined} />
          )}
          {training && <SelectField control={control} name="status" label={t.trainings.fields.status} options={TRAINING_STATUSES.map((s) => ({ value: s, label: t.enums.trainingStatus[s] }))} />}
        </Stack>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2.5}>
          <TextField label={t.trainings.fields.startDate} type="date" error={!!errors.startDate} helperText={errors.startDate?.message} {...register('startDate')} slotProps={{ inputLabel: { shrink: true } }} />
          <TextField label={t.trainings.fields.endDate} type="date" error={!!errors.endDate} helperText={errors.endDate?.message} {...register('endDate')} slotProps={{ inputLabel: { shrink: true } }} />
          <TextField label={t.trainings.fields.duration} type="number" error={!!errors.durationHours} helperText={errors.durationHours?.message ?? t.trainings.durationHint} {...register('durationHours')} slotProps={{ inputLabel: { shrink: true }, htmlInput: { min: 1, step: 1 } }} />
        </Stack>
      </Stack>
    </FormDialog>
  );
}
