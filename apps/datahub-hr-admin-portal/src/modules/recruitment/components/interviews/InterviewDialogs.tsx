import { useState } from 'react';
import Box from '@mui/material/Box';
import FormControl from '@mui/material/FormControl';
import FormHelperText from '@mui/material/FormHelperText';
import FormLabel from '@mui/material/FormLabel';
import MenuItem from '@mui/material/MenuItem';
import Rating from '@mui/material/Rating';
import TextField from '@mui/material/TextField';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '@/i18n/useLanguage';
import { FormDialog } from '@/modules/shared/FormDialog';
import { textFieldProps } from '@/modules/shared/formFields';
import { applyServerErrors } from '@/modules/shared/utils/serverErrors';
import { useCancelInterview, useSubmitFeedback } from '@/modules/recruitment/hooks/useRecruitment';
import { cancelSchema, feedbackFormSchema, type CancelValues, type FeedbackFormValues } from '@/modules/recruitment/schemas/recruitmentSchemas';
import { RECOMMENDATIONS, type Interview } from '@/modules/recruitment/types/recruitment';
import { errorText, fieldErrorText } from '@/modules/recruitment/utils/serverErrors';

/** Cancel a scheduled interview (reason required; nothing is sent to anyone — simulated). */
export function CancelInterviewDialog({ interview, onClose, onDone }: { interview: Interview; onClose: () => void; onDone: () => void }) {
  const { t } = useTranslation('recruitment');
  const { t: tCommon } = useTranslation();
  const cancel = useCancelInterview();
  const [formError, setFormError] = useState<string>();
  const { register, handleSubmit, formState, setError } = useForm<CancelValues>({ resolver: zodResolver(cancelSchema), defaultValues: { reason: '' } });
  const translate = (reason: string | undefined) => fieldErrorText(t, reason);
  const onSubmit = handleSubmit((v) =>
    cancel.mutate(
      { id: interview.id, reason: v.reason },
      {
        onSuccess: onDone,
        onError: (error) => {
          if (!applyServerErrors(error, ['reason'], setError)) setFormError(errorText(t, tCommon, error));
        },
      },
    ),
  );
  return (
    <FormDialog open title={t('interviews.cancelTitle')} onClose={onClose} onSubmit={onSubmit} submitLabel={t('actions.cancelInterview')} pending={cancel.isPending} error={formError}>
      <TextField label={t('fields.cancelReason')} required multiline minRows={2} autoFocus {...textFieldProps(register, formState, 'reason', translate)} />
    </FormDialog>
  );
}

const RATINGS = ['overall', 'technical', 'communication', 'problemSolving', 'experience'] as const;

/** Interview feedback by one assigned interviewer (1–5 ratings, recommendation). Final once submitted. */
export function FeedbackDialog({ interview, interviewerId, onClose, onDone }: { interview: Interview; interviewerId: string; onClose: () => void; onDone: () => void }) {
  const { t } = useTranslation('recruitment');
  const { t: tCommon } = useTranslation();
  const { language } = useLanguage();
  const submit = useSubmitFeedback();
  const [formError, setFormError] = useState<string>();
  const { register, control, handleSubmit, formState, setError } = useForm<FeedbackFormValues>({
    resolver: zodResolver(feedbackFormSchema),
    defaultValues: { interviewerId, overall: 0, technical: 0, communication: 0, problemSolving: 0, experience: 0, strengths: '', improvements: '', recommendation: undefined as never },
  });
  const translate = (reason: string | undefined) => fieldErrorText(t, reason);
  const interviewer = interview.interviewers.find((p) => p.id === interviewerId);
  const onSubmit = handleSubmit((v) =>
    submit.mutate(
      { id: interview.id, input: feedbackFormSchema.parse(v) },
      {
        onSuccess: onDone,
        onError: (error) => {
          if (!applyServerErrors(error, ['overall', 'technical', 'communication', 'problemSolving', 'experience', 'strengths', 'improvements', 'recommendation'], setError)) setFormError(errorText(t, tCommon, error));
        },
      },
    ),
  );
  return (
    <FormDialog open title={t('feedback.title', { name: interviewer?.name[language] ?? '' })} onClose={onClose} onSubmit={onSubmit} submitLabel={t('actions.submitFeedback')} pending={submit.isPending} error={formError}>
      <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}>
        {RATINGS.map((name) => (
          <Controller
            key={name}
            control={control}
            name={name}
            render={({ field, fieldState }) => (
              <FormControl error={Boolean(fieldState.error)} component="fieldset">
                <FormLabel component="legend" required sx={{ typography: 'body2' }}>
                  {t(`feedback.ratings.${name}`)}
                </FormLabel>
                {/* Ratings read left-to-right as a 1–5 scale in both languages. */}
                <Box dir="ltr" sx={{ display: 'flex', justifyContent: 'flex-start' }}>
                  <Rating name={name} value={field.value || null} onChange={(_, v) => field.onChange(v ?? 0)} getLabelText={(v) => t('feedback.ratingLabel', { value: v })} />
                </Box>
                {fieldState.error && <FormHelperText>{translate(fieldState.error.message)}</FormHelperText>}
              </FormControl>
            )}
          />
        ))}
      </Box>
      <TextField label={t('feedback.strengths')} required multiline minRows={2} {...textFieldProps(register, formState, 'strengths', translate)} />
      <TextField label={t('feedback.improvements')} required multiline minRows={2} {...textFieldProps(register, formState, 'improvements', translate)} />
      <Controller
        control={control}
        name="recommendation"
        render={({ field, fieldState }) => (
          <TextField select required label={t('feedback.recommendation')} value={field.value ?? ''} onChange={field.onChange} inputRef={field.ref} error={Boolean(fieldState.error)} helperText={translate(fieldState.error?.message) ?? t('feedback.finalNote')}>
            {RECOMMENDATIONS.map((r) => (
              <MenuItem key={r} value={r}>
                {t(`recommendations.${r}`)}
              </MenuItem>
            ))}
          </TextField>
        )}
      />
    </FormDialog>
  );
}
