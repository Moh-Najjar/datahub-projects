import { useState } from 'react';
import Box from '@mui/material/Box';
import TextField from '@mui/material/TextField';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm, type Path } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '@/i18n/useLanguage';
import { FormDialog } from '@/modules/shared/FormDialog';
import { arabicInput, latinInput, textFieldProps } from '@/modules/shared/formFields';
import { applyServerErrors } from '@/modules/shared/utils/serverErrors';
import { useCreateCandidate, useRequisitions, useUpdateCandidate } from '@/modules/recruitment/hooks/useRecruitment';
import { candidateFormSchema, candidateToForm, toCandidateInput, type CandidateFormValues } from '@/modules/recruitment/schemas/recruitmentSchemas';
import { CANDIDATE_SOURCES, EDUCATION_LEVELS, type Candidate } from '@/modules/recruitment/types/recruitment';
import { todayIso } from '@/modules/recruitment/utils/pipeline';
import { errorText, fieldErrorText } from '@/modules/recruitment/utils/serverErrors';
import { SelectField } from '@/modules/shared/SelectField';
import { StaffPicker } from '../common/StaffPicker';

const FIELDS = ['firstNameEn', 'lastNameEn', 'firstNameAr', 'lastNameAr', 'email', 'phone', 'location', 'currentTitle', 'currentCompany', 'experienceYears', 'education', 'skills', 'languages', 'linkedinUrl', 'portfolioUrl', 'requisitionId', 'appliedAt', 'source', 'recruiterId', 'expectedSalary', 'notes'] as const;

/** Add or edit a candidate (fictional data only in this demo). New candidates start at "New application". */
export function CandidateFormDialog({ candidate, requisitionId, onClose, onDone }: { candidate?: Candidate; requisitionId?: string; onClose: () => void; onDone: (c: Candidate) => void }) {
  const { t } = useTranslation('recruitment');
  const { t: tCommon } = useTranslation();
  const { language } = useLanguage();
  const create = useCreateCandidate();
  const update = useUpdateCandidate();
  const mutation = candidate ? update : create;
  const [formError, setFormError] = useState<string>();
  // New applications go to OPEN requisitions; an edited candidate keeps theirs.
  const requisitions = useRequisitions({ page: 1, pageSize: 100, sortBy: 'number', sortDirection: 'desc', filters: { status: 'open' } });
  const options = [
    ...(candidate && !(requisitions.data?.items ?? []).some((r) => r.id === candidate.requisition.id) ? [{ value: candidate.requisition.id, label: `${candidate.requisition.number} · ${candidate.requisition.title[language]}` }] : []),
    ...(requisitions.data?.items ?? []).map((r) => ({ value: r.id, label: `${r.number} · ${r.title[language]}` })),
  ];
  const defaults: CandidateFormValues = candidate
    ? candidateToForm({ ...candidate, requisitionId: candidate.requisition.id, recruiterId: candidate.recruiter?.id ?? null })
    : { ...candidateToForm({ name: { first: { en: '', ar: '' }, last: { en: '', ar: '' } }, skills: [], languages: [] } as never), experienceYears: 0, education: 'bachelor', source: 'careers-site', appliedAt: todayIso(), requisitionId: requisitionId ?? '' };
  const { register, control, handleSubmit, formState, setError } = useForm<CandidateFormValues>({ resolver: zodResolver(candidateFormSchema), defaultValues: defaults });
  const translate = (reason: string | undefined) => fieldErrorText(t, reason);
  const text = (name: Path<CandidateFormValues>, helper?: string) => textFieldProps(register, formState, name, translate, helper);
  const number = (name: 'experienceYears' | 'expectedSalary', label: string, required: boolean, helper?: string) => {
    const { ref, ...field } = register(name, { setValueAs: (v: unknown) => (v === '' || v === null || v === undefined ? undefined : Number(v)) });
    const message = formState.errors[name]?.message;
    const error = translate(typeof message === 'string' ? message : undefined);
    return <TextField type="number" label={label} required={required} {...field} inputRef={ref} error={Boolean(error)} helperText={error ?? helper} slotProps={{ htmlInput: { dir: 'ltr', min: 0 } }} />;
  };

  const onSubmit = handleSubmit((v) => {
    setFormError(undefined);
    const input = toCandidateInput(candidateFormSchema.parse(v));
    const callbacks = {
      onSuccess: onDone,
      onError: (error: Error) => {
        if (!applyServerErrors(error, FIELDS, setError)) setFormError(errorText(t, tCommon, error));
      },
    };
    if (candidate) update.mutate({ id: candidate.id, input }, callbacks);
    else create.mutate(input, callbacks);
  });
  const grid = { display: 'grid', gap: 2.5, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } } as const;

  return (
    <FormDialog open maxWidth="md" title={candidate ? t('candidates.editTitle', { number: candidate.number }) : t('candidates.createTitle')} onClose={onClose} onSubmit={onSubmit} submitLabel={candidate ? t('actions.save') : t('actions.create')} pending={mutation.isPending} error={formError}>
      <Box component="fieldset" sx={{ border: 0, p: 0, m: 0, display: 'grid', gap: 2.5 }}>
        <Box component="legend" sx={{ typography: 'subtitle2', mb: 1.5 }}>
          {t('candidates.sections.personal')}
        </Box>
        <Box sx={grid}>
          <TextField label={t('fields.firstNameEn')} required {...text('firstNameEn')} slotProps={latinInput} />
          <TextField label={t('fields.lastNameEn')} required {...text('lastNameEn')} slotProps={latinInput} />
          <TextField label={t('fields.firstNameAr')} {...text('firstNameAr')} slotProps={arabicInput} />
          <TextField label={t('fields.lastNameAr')} {...text('lastNameAr')} slotProps={arabicInput} />
          <TextField label={t('fields.email')} type="email" required {...text('email', t('candidates.emailHint'))} slotProps={latinInput} />
          <TextField label={t('fields.phone')} type="tel" required {...text('phone')} slotProps={latinInput} />
          <TextField label={t('fields.location')} {...text('location')} />
        </Box>
      </Box>
      <Box component="fieldset" sx={{ border: 0, p: 0, m: 0, display: 'grid', gap: 2.5 }}>
        <Box component="legend" sx={{ typography: 'subtitle2', mb: 1.5 }}>
          {t('candidates.sections.professional')}
        </Box>
        <Box sx={grid}>
          <TextField label={t('fields.currentTitle')} {...text('currentTitle')} />
          <TextField label={t('fields.currentCompany')} {...text('currentCompany')} />
          {number('experienceYears', t('fields.experienceYears'), true)}
          <SelectField control={control} name="education" label={t('fields.education')} translate={translate} options={EDUCATION_LEVELS.map((e) => ({ value: e, label: t(`education.${e}`) }))} />
          <TextField label={t('fields.candidateSkills')} {...text('skills', t('form.listHint'))} />
          <TextField label={t('fields.languages')} {...text('languages', t('form.listHint'))} />
          <TextField label={t('fields.linkedinUrl')} type="url" {...text('linkedinUrl', t('form.urlHint'))} slotProps={latinInput} />
          <TextField label={t('fields.portfolioUrl')} type="url" {...text('portfolioUrl', t('form.urlHint'))} slotProps={latinInput} />
        </Box>
      </Box>
      <Box component="fieldset" sx={{ border: 0, p: 0, m: 0, display: 'grid', gap: 2.5 }}>
        <Box component="legend" sx={{ typography: 'subtitle2', mb: 1.5 }}>
          {t('candidates.sections.recruitment')}
        </Box>
        <Box sx={grid}>
          <SelectField control={control} name="requisitionId" label={t('fields.appliedPosition')} translate={translate} options={options} />
          <TextField label={t('fields.appliedAt')} type="date" required {...text('appliedAt')} slotProps={{ inputLabel: { shrink: true }, htmlInput: { dir: 'ltr', max: todayIso() } }} />
          <SelectField control={control} name="source" label={t('fields.source')} translate={translate} options={CANDIDATE_SOURCES.map((s) => ({ value: s, label: t(`sources.${s}`) }))} />
          <Controller control={control} name="recruiterId" render={({ field, fieldState }) => <StaffPicker label={t('fields.recruiter')} value={field.value} onChange={field.onChange} error={translate(fieldState.error?.message)} known={candidate?.recruiter ? [candidate.recruiter] : []} />} />
          {number('expectedSalary', t('fields.expectedSalary'), false, t('candidates.salaryHint'))}
        </Box>
        <TextField label={t('fields.notes')} multiline minRows={2} {...text('notes')} />
      </Box>
    </FormDialog>
  );
}
