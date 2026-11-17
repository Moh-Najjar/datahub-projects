import { useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm, type FieldValues, type Path, type UseFormSetError } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '@/i18n/useLanguage';
import { textFieldProps } from '@/modules/shared/formFields';
import { applyServerErrors } from '@/modules/shared/utils/serverErrors';
import { useSubmitManagerReview, useSubmitSelfAssessment } from '@/modules/performance/hooks/usePerformance';
import { managerReviewSchema, selfAssessmentSchema, type ManagerReviewValues, type SelfAssessmentValues } from '@/modules/performance/schemas/performanceSchemas';
import type { Review } from '@/modules/performance/types/performance';
import { errorText, fieldErrorText } from '@/modules/performance/utils/serverErrors';
import { RatingSelect } from '../common/Fields';

type Notify = (text: string, severity?: 'success' | 'error') => void;

function useServerErrors<T extends FieldValues>(setError: UseFormSetError<T>, fields: readonly string[]) {
  const { t } = useTranslation('performance');
  const { t: tCommon } = useTranslation();
  const [formError, setFormError] = useState<string>();
  const onError = (error: unknown) => {
    if (!applyServerErrors(error, fields as Path<T>[], setError)) setFormError(errorText(t, tCommon, error));
  };
  return { formError, setFormError, onError };
}

function Actions({ pending, onDraft }: { pending: boolean; onDraft: () => void }) {
  const { t } = useTranslation('performance');
  const { t: tCommon } = useTranslation();
  return (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 1.5 }}>
      <Button variant="outlined" onClick={onDraft} disabled={pending}>
        {t('actions.saveDraft')}
      </Button>
      <Button type="submit" variant="contained" disabled={pending}>
        {pending ? tCommon('actions.saving') : t('actions.submit')}
      </Button>
    </Box>
  );
}

/** Self-assessment by the employee: rate goal achievement, achievements, challenges and comments; draft or submit. */
export function SelfAssessmentForm({ review, notify }: { review: Review; notify: Notify }) {
  const { t } = useTranslation('performance');
  const mutation = useSubmitSelfAssessment();
  const saved = review.selfAssessment!;
  const { register, control, handleSubmit, formState, setError, setValue } = useForm<SelfAssessmentValues>({
    resolver: zodResolver(selfAssessmentSchema),
    defaultValues: { goalRatings: review.goals.map((g) => ({ goalId: g.id, rating: saved.goalRatings.find((x) => x.goalId === g.id)?.rating ?? null, comment: saved.goalRatings.find((x) => x.goalId === g.id)?.comment ?? '' })), achievements: saved.achievements, challenges: saved.challenges, comments: saved.comments, submit: true },
  });
  const fields = ['achievements', 'challenges', 'comments', ...review.goals.map((_, i) => `goalRatings.${i}.rating`)];
  const { formError, setFormError, onError } = useServerErrors(setError, fields);
  const translate = (reason: string | undefined) => fieldErrorText(t, reason);
  const save = handleSubmit((v) => {
    setFormError(undefined);
    mutation.mutate({ id: review.id, input: selfAssessmentSchema.parse(v) }, { onSuccess: () => notify(t(v.submit ? 'reviews.selfSubmitted' : 'reviews.draftSaved')), onError });
  });

  return (
    <Box component="form" noValidate onSubmit={(e) => { setValue('submit', true); void save(e); }} aria-label={t('reviews.selfAssessment')}>
      <Stack spacing={2.5}>
        {formError && <Alert severity="error">{formError}</Alert>}
        <Alert severity="info">{t('reviews.selfHint')}</Alert>
        <Typography variant="subtitle1" component="h4">
          {t('reviews.goalAchievement')}
        </Typography>
        {review.goals.length === 0 && <Typography color="text.secondary">{t('reviews.noGoals')}</Typography>}
        {review.goals.map((g, i) => (
          <Paper key={g.id} variant="outlined" sx={{ p: 2, display: 'grid', gap: 1.5 }}>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              {g.title}
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
              <Controller control={control} name={`goalRatings.${i}.rating`} render={({ field, fieldState }) => <RatingSelect label={t('fields.rating')} value={field.value} onChange={field.onChange} error={translate(fieldState.error?.message)} required />} />
              <TextField label={t('fields.comment')} sx={{ flex: '1 1 260px' }} {...textFieldProps(register, formState, `goalRatings.${i}.comment`, translate)} />
            </Box>
          </Paper>
        ))}
        <TextField label={t('fields.achievements')} required multiline minRows={3} {...textFieldProps(register, formState, 'achievements', translate)} />
        <TextField label={t('fields.challenges')} multiline minRows={2} {...textFieldProps(register, formState, 'challenges', translate)} />
        <TextField label={t('fields.employeeComments')} multiline minRows={2} {...textFieldProps(register, formState, 'comments', translate)} />
        <Actions
          pending={mutation.isPending}
          onDraft={() => {
            setValue('submit', false);
            void save();
          }}
        />
      </Stack>
    </Box>
  );
}

/** Manager review: goal achievement, competencies, strengths, improvements, development, comments and overall rating. */
export function ManagerReviewForm({ review, notify }: { review: Review; notify: Notify }) {
  const { t } = useTranslation('performance');
  const { language } = useLanguage();
  const mutation = useSubmitManagerReview();
  const saved = review.managerReview;
  const ratingOf = <K extends 'goalId' | 'competencyId'>(list: ReadonlyArray<Record<K, string> & { rating: number | null; comment: string }> | undefined, key: K, id: string) => list?.find((x) => x[key] === id);
  const { register, control, handleSubmit, formState, setError, setValue } = useForm<ManagerReviewValues>({
    resolver: zodResolver(managerReviewSchema),
    defaultValues: {
      goalRatings: review.goals.map((g) => ({ goalId: g.id, rating: ratingOf(saved?.goalRatings, 'goalId', g.id)?.rating ?? null, comment: ratingOf(saved?.goalRatings, 'goalId', g.id)?.comment ?? '' })),
      competencyRatings: review.competencies.map((c) => ({ competencyId: c.id, rating: ratingOf(saved?.competencyRatings, 'competencyId', c.id)?.rating ?? null, comment: ratingOf(saved?.competencyRatings, 'competencyId', c.id)?.comment ?? '' })),
      strengths: saved?.strengths ?? '',
      improvements: saved?.improvements ?? '',
      development: saved?.development ?? '',
      comments: saved?.comments ?? '',
      overallRating: saved?.overallRating ?? null,
      submit: true,
    },
  });
  const fields = ['strengths', 'improvements', 'development', 'comments', 'overallRating', ...review.goals.map((_, i) => `goalRatings.${i}.rating`), ...review.competencies.map((_, i) => `competencyRatings.${i}.rating`)];
  const { formError, setFormError, onError } = useServerErrors(setError, fields);
  const translate = (reason: string | undefined) => fieldErrorText(t, reason);
  const save = handleSubmit((v) => {
    setFormError(undefined);
    mutation.mutate({ id: review.id, input: managerReviewSchema.parse(v) }, { onSuccess: () => notify(t(v.submit ? 'reviews.managerSubmitted' : 'reviews.draftSaved')), onError });
  });
  const ratingRow = (name: `goalRatings.${number}` | `competencyRatings.${number}`, title: string, key: string) => (
    <Paper key={key} variant="outlined" sx={{ p: 2, display: 'grid', gap: 1.5 }}>
      <Typography variant="body2" sx={{ fontWeight: 600 }}>
        {title}
      </Typography>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
        <Controller control={control} name={`${name}.rating`} render={({ field, fieldState }) => <RatingSelect label={t('fields.rating')} value={field.value} onChange={field.onChange} error={translate(fieldState.error?.message)} required />} />
        <TextField label={t('fields.comment')} sx={{ flex: '1 1 260px' }} {...textFieldProps(register, formState, `${name}.comment`, translate)} />
      </Box>
    </Paper>
  );

  return (
    <Box component="form" noValidate onSubmit={(e) => { setValue('submit', true); void save(e); }} aria-label={t('reviews.managerReview')}>
      <Stack spacing={2.5}>
        {formError && <Alert severity="error">{formError}</Alert>}
        <Alert severity="info">{t('reviews.managerHint')}</Alert>
        <Typography variant="subtitle1" component="h4">
          {t('reviews.goalAchievement')}
        </Typography>
        {review.goals.map((g, i) => ratingRow(`goalRatings.${i}`, g.title, g.id))}
        <Typography variant="subtitle1" component="h4">
          {t('reviews.competencies')}
        </Typography>
        {review.competencies.map((c, i) => ratingRow(`competencyRatings.${i}`, c.name[language], c.id))}
        <TextField label={t('fields.strengths')} required multiline minRows={2} {...textFieldProps(register, formState, 'strengths', translate)} />
        <TextField label={t('fields.improvements')} required multiline minRows={2} {...textFieldProps(register, formState, 'improvements', translate)} />
        <TextField label={t('fields.development')} multiline minRows={2} {...textFieldProps(register, formState, 'development', translate)} />
        <TextField label={t('fields.managerComments')} multiline minRows={2} {...textFieldProps(register, formState, 'comments', translate)} />
        <Controller control={control} name="overallRating" render={({ field, fieldState }) => <RatingSelect label={t('fields.overallRating')} value={field.value} onChange={field.onChange} error={translate(fieldState.error?.message)} required />} />
        <Actions
          pending={mutation.isPending}
          onDraft={() => {
            setValue('submit', false);
            void save();
          }}
        />
      </Stack>
    </Box>
  );
}
