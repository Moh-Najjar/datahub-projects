import { useEffect, useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Grid from '@mui/material/Grid';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlinedIcon from '@mui/icons-material/DeleteOutlined';
import { zodResolver } from '@hookform/resolvers/zod';
import { useFieldArray, useForm, useWatch } from 'react-hook-form';
import { DEFAULT_SCORE, MAX_SCORE, MIN_SCORE } from '@/core/config/evaluationDefaults';
import { evaluationMaxTotal, evaluationTotal } from '@/core/utils/scoring';
import { fill } from '@/i18n';
import { formatNumber, toDateInputValue } from '@/i18n/format';
import { useLocale } from '@/i18n/LocaleContext';
import { useT } from '@/i18n/useT';
import { FormDialog } from '@/modules/shared/FormDialog';
import { SelectField } from '@/modules/shared/SelectField';
import { applyServerErrors } from '@/modules/shared/utils/apiMessage';
import type { EnrollmentDto } from '@/modules/enrollments';
import { useCreateEvaluation, useUpdateEvaluation } from '../hooks/useEvaluations';
import { evaluationSchema, type EvaluationFormValues } from '../schemas/evaluationSchema';
import type { EvaluationDto } from '../types/evaluation';

interface EvaluationFormDialogProps {
  userId: string;
  enrollments: readonly EnrollmentDto[];
  /** null = a new evaluation. */
  evaluation: EvaluationDto | null;
  /** The categories to start from: the latest evaluation's (scores reset) or the original defaults. */
  seedCategories: { categoryName: string; criteria: string }[];
  onClose: () => void;
  onSaved: (created: boolean) => void;
}

/** The ISO instant stored for a calendar day (local noon, so the day never shifts across time zones). */
const dayToIso = (day: string): string => new Date(`${day}T12:00:00`).toISOString();

/**
 * Evaluation form (create / edit): a date, an optional enrollment, and any number of categories, each scored 1–10.
 * The total and the maximum (categories × 10) update live — the original scoring, unchanged.
 */
export function EvaluationFormDialog({ userId, enrollments, evaluation, seedCategories, onClose, onSaved }: EvaluationFormDialogProps) {
  const t = useT();
  const { locale } = useLocale();
  const create = useCreateEvaluation(userId);
  const update = useUpdateEvaluation();
  const [failure, setFailure] = useState<unknown>(null);

  const [today] = useState(() => toDateInputValue(new Date()));
  const defaults = useMemo<EvaluationFormValues>(
    () => ({
      evaluatedAt: evaluation ? toDateInputValue(evaluation.evaluatedAt) : today,
      enrollmentId: evaluation?.enrollmentId ?? '',
      categories: evaluation ? evaluation.categories.map((c) => ({ categoryName: c.categoryName, criteria: c.criteria, score: c.score })) : seedCategories.map((c) => ({ ...c, score: DEFAULT_SCORE })),
    }),
    [evaluation, seedCategories, today],
  );
  const { register, control, handleSubmit, setError, setFocus, formState: { errors, isSubmitting } } = useForm<EvaluationFormValues>({ resolver: zodResolver(evaluationSchema(t)), defaultValues: defaults });
  const { fields, append, remove } = useFieldArray({ control, name: 'categories' });
  const watched = useWatch({ control, name: 'categories' });
  useEffect(() => setFocus('evaluatedAt'), [setFocus]);

  const scores = (watched ?? []).map((c) => ({ score: Number.isFinite(Number(c?.score)) ? Number(c.score) : 0 }));
  const total = evaluationTotal(scores);
  const max = evaluationMaxTotal(scores);

  const submit = handleSubmit(async (values) => {
    setFailure(null);
    const categories = values.categories.map((c) => ({ categoryName: c.categoryName, criteria: c.criteria, score: c.score }));
    try {
      if (evaluation) await update.mutateAsync({ id: evaluation.id, input: { evaluatedAt: dayToIso(values.evaluatedAt), categories } });
      else await create.mutateAsync({ enrollmentId: values.enrollmentId || null, evaluatedAt: dayToIso(values.evaluatedAt), categories });
      onSaved(!evaluation);
      onClose();
    } catch (error) {
      if (!applyServerErrors(t, error, setError, ['evaluatedAt', 'enrollmentId'])) setFailure(error);
    }
  });

  return (
    <FormDialog open title={evaluation ? t.evaluations.edit : t.evaluations.new} submitLabel={evaluation ? t.common.save : t.evaluations.submit} isSubmitting={isSubmitting} error={failure} onClose={onClose} onSubmit={submit} maxWidth="lg">
      <Stack spacing={3} sx={{ pt: 1 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2.5}>
          <TextField label={t.evaluations.fields.date} type="date" required error={!!errors.evaluatedAt} helperText={errors.evaluatedAt?.message} {...register('evaluatedAt')} slotProps={{ inputLabel: { shrink: true } }} sx={{ maxWidth: { sm: 240 } }} />
          <SelectField
            control={control}
            name="enrollmentId"
            label={t.evaluations.fields.enrollment}
            disabled={!!evaluation}
            emptyLabel={t.evaluations.noEnrollment}
            helperText={t.evaluations.enrollmentHint}
            options={enrollments.map((e) => ({ value: e.id, label: `${e.trainingTitle} (${t.enums.enrollmentStatus[e.status]})` }))}
          />
        </Stack>

        <Box>
          <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
            <Typography variant="h6" component="h3">
              {t.evaluations.categories}
            </Typography>
            <Typography sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }} aria-live="polite">
              {fill(t.evaluations.totalOf, { total: formatNumber(total, locale), max: formatNumber(max, locale) })}
            </Typography>
          </Stack>
          <Stack spacing={1.5}>
            {fields.map((field, index) => {
              const row = errors.categories?.[index];
              return (
                <Box key={field.id} sx={{ p: 1.5, borderRadius: 1, border: 1, borderColor: 'divider', bgcolor: 'grey.50' }}>
                  <Grid container spacing={1.5} sx={{ alignItems: "flex-start" }}>
                    <Grid size={{ xs: 12, md: 3 }}>
                      <TextField label={t.evaluations.fields.category} required error={!!row?.categoryName} helperText={row?.categoryName?.message} {...register(`categories.${index}.categoryName`)} slotProps={{ inputLabel: { shrink: true } }} />
                    </Grid>
                    <Grid size={{ xs: 12, md: 6 }}>
                      <TextField label={t.evaluations.fields.criteria} multiline minRows={1} maxRows={4} error={!!row?.criteria} helperText={row?.criteria?.message} {...register(`categories.${index}.criteria`)} slotProps={{ inputLabel: { shrink: true } }} />
                    </Grid>
                    <Grid size={{ xs: 8, md: 2 }}>
                      <TextField
                        label={fill(t.evaluations.fields.score, { min: MIN_SCORE, max: MAX_SCORE })}
                        type="number"
                        required
                        error={!!row?.score}
                        helperText={row?.score?.message}
                        {...register(`categories.${index}.score`, { valueAsNumber: true })}
                        slotProps={{ inputLabel: { shrink: true }, htmlInput: { min: MIN_SCORE, max: MAX_SCORE, step: 1, inputMode: 'numeric' } }}
                      />
                    </Grid>
                    <Grid size={{ xs: 4, md: 1 }} sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                      <Tooltip title={t.evaluations.removeCategory}>
                        <span>
                          <IconButton aria-label={`${t.evaluations.removeCategory} ${index + 1}`} disabled={fields.length === 1} onClick={() => remove(index)}>
                            <DeleteOutlinedIcon />
                          </IconButton>
                        </span>
                      </Tooltip>
                    </Grid>
                  </Grid>
                </Box>
              );
            })}
          </Stack>
          {typeof errors.categories?.message === 'string' && (
            <Typography color="error" variant="body2" role="alert" sx={{ mt: 1 }}>
              {errors.categories.message}
            </Typography>
          )}
          <Button startIcon={<AddIcon />} onClick={() => append({ categoryName: '', criteria: '', score: DEFAULT_SCORE })} sx={{ mt: 1.5 }}>
            {t.evaluations.addCategory}
          </Button>
        </Box>
      </Stack>
    </FormDialog>
  );
}
