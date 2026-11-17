import { useEffect, useState } from 'react';
import Alert from '@mui/material/Alert';
import Autocomplete from '@mui/material/Autocomplete';
import Box from '@mui/material/Box';
import TextField from '@mui/material/TextField';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm, useWatch, type Path } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '@/i18n/useLanguage';
import { FormDialog } from '@/modules/shared/FormDialog';
import { latinInput, textFieldProps } from '@/modules/shared/formFields';
import { applyServerErrors } from '@/modules/shared/utils/serverErrors';
import { useCandidates, useCreateInterview, useUpdateInterview } from '@/modules/recruitment/hooks/useRecruitment';
import { interviewFormSchema, toInterviewInput, type InterviewFormValues } from '@/modules/recruitment/schemas/recruitmentSchemas';
import { INTERVIEW_TYPES, type Candidate, type CandidateSummary, type Interview } from '@/modules/recruitment/types/recruitment';
import { personName } from '@/modules/recruitment/utils/format';
import { addDays, todayIso } from '@/modules/recruitment/utils/pipeline';
import { errorText, fieldErrorText } from '@/modules/recruitment/utils/serverErrors';
import { SelectField } from '@/modules/shared/SelectField';
import { StaffMultiPicker } from '../common/StaffPicker';

const FIELDS = ['candidateId', 'type', 'start', 'durationMinutes', 'interviewerIds', 'location', 'meetingLink', 'notes'] as const;

/**
 * Schedule (or reschedule) an interview. SIMULATED scheduling: nothing is sent to the candidate or the interviewers and
 * no calendar event is created. The API refuses past times and double bookings.
 */
export function InterviewFormDialog({ candidate, interview, onClose, onDone }: { candidate?: Candidate; interview?: Interview; onClose: () => void; onDone: (i: Interview) => void }) {
  const { t } = useTranslation('recruitment');
  const { t: tCommon } = useTranslation();
  const create = useCreateInterview();
  const update = useUpdateInterview();
  const mutation = interview ? update : create;
  const [formError, setFormError] = useState<string>();
  const fixed = interview?.candidate ?? candidate ?? null;
  const defaults: InterviewFormValues = interview
    ? { candidateId: interview.candidate.id, type: interview.type, start: interview.start, durationMinutes: interview.durationMinutes, interviewerIds: interview.interviewers.map((p) => p.id), location: interview.location, meetingLink: interview.meetingLink, notes: interview.notes }
    : { candidateId: candidate?.id ?? '', type: 'video', start: `${addDays(todayIso(), 1)}T10:00`, durationMinutes: 60, interviewerIds: [], location: '', meetingLink: '', notes: '' };
  const { register, control, handleSubmit, formState, setError } = useForm<InterviewFormValues>({ resolver: zodResolver(interviewFormSchema), defaultValues: defaults });
  const type = useWatch({ control, name: 'type' });
  const translate = (reason: string | undefined) => fieldErrorText(t, reason);
  const text = (name: Path<InterviewFormValues>, helper?: string) => textFieldProps(register, formState, name, translate, helper);
  const duration = register('durationMinutes', { setValueAs: (v: unknown) => (v === '' ? undefined : Number(v)) });
  const durationError = translate(formState.errors.durationMinutes?.message);

  const onSubmit = handleSubmit((v) => {
    setFormError(undefined);
    const input = toInterviewInput(interviewFormSchema.parse(v));
    const callbacks = {
      onSuccess: onDone,
      onError: (error: Error) => {
        if (!applyServerErrors(error, FIELDS, setError)) setFormError(errorText(t, tCommon, error));
      },
    };
    if (interview) update.mutate({ id: interview.id, input }, callbacks);
    else create.mutate(input, callbacks);
  });

  return (
    <FormDialog open title={interview ? t('interviews.editTitle') : t('interviews.createTitle')} onClose={onClose} onSubmit={onSubmit} submitLabel={interview ? t('actions.save') : t('actions.schedule')} pending={mutation.isPending} error={formError}>
      <Alert severity="info">{t('interviews.simulatedNote')}</Alert>
      <Controller control={control} name="candidateId" render={({ field, fieldState }) => <CandidatePicker fixed={fixed} value={field.value} onChange={field.onChange} error={translate(fieldState.error?.message)} />} />
      <Box sx={{ display: 'grid', gap: 2.5, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}>
        <SelectField control={control} name="type" label={t('fields.interviewType')} translate={translate} options={INTERVIEW_TYPES.map((x) => ({ value: x, label: t(`interviewTypes.${x}`) }))} />
        <TextField label={t('fields.start')} type="datetime-local" required {...text('start')} slotProps={{ inputLabel: { shrink: true }, htmlInput: { dir: 'ltr', step: 300 } }} />
        <TextField label={t('fields.duration')} type="number" required {...duration} inputRef={duration.ref} error={Boolean(durationError)} helperText={durationError} slotProps={{ htmlInput: { dir: 'ltr', min: 15, step: 15 } }} />
      </Box>
      <Controller
        control={control}
        name="interviewerIds"
        render={({ field, fieldState }) => <StaffMultiPicker required label={t('fields.interviewers')} value={field.value} onChange={field.onChange} error={translate(fieldState.error?.message)} known={interview?.interviewers ?? []} />}
      />
      {(type === 'in-person' || type === 'technical' || type === 'hr' || type === 'final') && <TextField label={t('fields.interviewLocation')} required={type === 'in-person'} {...text('location')} />}
      {(type === 'video' || type === 'technical' || type === 'final' || type === 'hr') && <TextField label={t('fields.meetingLink')} required={type === 'video'} {...text('meetingLink', t('form.urlHint'))} slotProps={latinInput} />}
      <TextField label={t('fields.notes')} multiline minRows={2} {...text('notes')} />
    </FormDialog>
  );
}

/** Candidate for a new interview (searched on the server); fixed when scheduling from a candidate. */
function CandidatePicker({ fixed, value, onChange, error }: { fixed: CandidateSummary | null; value: string; onChange: (id: string) => void; error?: string }) {
  const { t } = useTranslation('recruitment');
  const { language } = useLanguage();
  const [input, setInput] = useState('');
  const [search, setSearch] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => setSearch(input.trim()), 300);
    return () => clearTimeout(timer);
  }, [input]);
  const query = useCandidates({ page: 1, pageSize: 20, search: search || undefined, sortBy: 'appliedAt', sortDirection: 'desc' }, !fixed);
  if (fixed) return <TextField label={t('fields.candidate')} value={`${personName(fixed.name, language)} (${fixed.number})`} slotProps={{ input: { readOnly: true } }} />;
  const options: CandidateSummary[] = query.data?.items ?? [];
  return (
    <Autocomplete<CandidateSummary>
      options={options}
      value={options.find((o) => o.id === value) ?? null}
      onChange={(_, o) => onChange(o?.id ?? '')}
      onInputChange={(_, v, reason) => reason === 'input' && setInput(v)}
      filterOptions={(o) => o}
      loading={query.isFetching}
      getOptionLabel={(o) => `${personName(o.name, language)} (${o.number})`}
      getOptionKey={(o) => o.id}
      isOptionEqualToValue={(a, b) => a.id === b.id}
      noOptionsText={t('picker.noResults')}
      renderInput={(params) => <TextField {...params} required label={t('fields.candidate')} error={Boolean(error)} helperText={error ?? t('interviews.candidateHint')} />}
    />
  );
}
