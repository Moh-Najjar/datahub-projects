import { useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import TextField from '@mui/material/TextField';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm, useWatch, type Path } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '@/i18n/useLanguage';
import { useDepartmentOptions, useLocations, usePositions } from '@/modules/organization';
import { FormDialog } from '@/modules/shared/FormDialog';
import { arabicInput, latinInput, textFieldProps } from '@/modules/shared/formFields';
import { applyServerErrors } from '@/modules/shared/utils/serverErrors';
import { useCreateRequisition, useUpdateRequisition } from '@/modules/recruitment/hooks/useRecruitment';
import { requisitionFormSchema, requisitionToForm, toRequisitionInput, type RequisitionFormValues } from '@/modules/recruitment/schemas/recruitmentSchemas';
import { CURRENCIES, EDUCATION_LEVELS, EMPLOYMENT_TYPES, type Requisition } from '@/modules/recruitment/types/recruitment';
import { todayIso } from '@/modules/recruitment/utils/pipeline';
import { errorText, fieldErrorText } from '@/modules/recruitment/utils/serverErrors';
import { SelectField } from '@/modules/shared/SelectField';
import { StaffPicker } from '../common/StaffPicker';

const FIELDS = ['titleEn', 'titleAr', 'departmentId', 'positionId', 'locationId', 'employmentType', 'vacancies', 'hiringManagerId', 'recruiterId', 'description', 'skills', 'minExperienceYears', 'education', 'salaryMin', 'salaryMax', 'openingDate', 'closingDate'] as const;
const dateSlot = { inputLabel: { shrink: true }, htmlInput: { dir: 'ltr' } } as const;

/** Create (draft) or edit a job requisition. Departments, positions and locations come from Organization Management. */
export function RequisitionFormDialog({ requisition, onClose, onDone }: { requisition?: Requisition; onClose: () => void; onDone: (r: Requisition) => void }) {
  const { t } = useTranslation('recruitment');
  const { t: tCommon } = useTranslation();
  const { language } = useLanguage();
  const create = useCreateRequisition();
  const update = useUpdateRequisition();
  const mutation = requisition ? update : create;
  const [formError, setFormError] = useState<string>();
  const defaults: RequisitionFormValues = requisition
    ? requisitionToForm({ ...requisition, departmentId: requisition.department.id, positionId: requisition.position.id, locationId: requisition.location.id, hiringManagerId: requisition.hiringManager?.id ?? null, recruiterId: requisition.recruiter?.id ?? null })
    : { ...requisitionToForm({ title: { en: '', ar: '' }, skills: [], salaryRange: null } as never), employmentType: 'full-time', vacancies: 1, minExperienceYears: 0, education: 'bachelor', openingDate: todayIso(), currency: 'JOD' };
  const { register, control, handleSubmit, formState, setError, setValue } = useForm<RequisitionFormValues>({ resolver: zodResolver(requisitionFormSchema), defaultValues: defaults });
  const [departmentId, hasSalary] = useWatch({ control, name: ['departmentId', 'hasSalaryRange'] });
  const { options: departments } = useDepartmentOptions({ keep: requisition?.department.id });
  const positions = usePositions({ page: 1, pageSize: 100, sortBy: `title.${language}`, sortDirection: 'asc', filters: { departmentId } }, Boolean(departmentId));
  const locations = useLocations({ page: 1, pageSize: 100, sortBy: `name.${language}`, sortDirection: 'asc' });
  const translate = (reason: string | undefined) => fieldErrorText(t, reason);
  const text = (name: Path<RequisitionFormValues>, helper?: string) => textFieldProps(register, formState, name, translate, helper);

  const onSubmit = handleSubmit((v) => {
    setFormError(undefined);
    const input = toRequisitionInput(requisitionFormSchema.parse(v));
    const callbacks = {
      onSuccess: onDone,
      onError: (error: Error) => {
        if (!applyServerErrors(error, FIELDS, setError)) setFormError(errorText(t, tCommon, error));
      },
    };
    if (requisition) update.mutate({ id: requisition.id, input }, callbacks);
    else create.mutate(input, callbacks);
  });

  const number = (name: 'vacancies' | 'minExperienceYears' | 'salaryMin' | 'salaryMax', label: string, required = true) => {
    const { ref, ...field } = register(name, { setValueAs: (v: unknown) => (v === '' || v === null || v === undefined ? undefined : Number(v)) });
    const message = formState.errors[name]?.message;
    const error = translate(typeof message === 'string' ? message : undefined);
    return <TextField type="number" label={label} required={required} {...field} inputRef={ref} error={Boolean(error)} helperText={error} slotProps={{ htmlInput: { dir: 'ltr', min: 0 } }} />;
  };

  return (
    <FormDialog open maxWidth="md" title={requisition ? t('requisitions.editTitle', { number: requisition.number }) : t('requisitions.createTitle')} onClose={onClose} onSubmit={onSubmit} submitLabel={requisition ? t('actions.save') : t('actions.create')} pending={mutation.isPending} error={formError}>
      {!requisition && <Alert severity="info">{t('requisitions.draftNote')}</Alert>}
      <Box sx={{ display: 'grid', gap: 2.5, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}>
        <TextField label={t('fields.titleEn')} required {...text('titleEn')} slotProps={latinInput} />
        <TextField label={t('fields.titleAr')} required {...text('titleAr')} slotProps={arabicInput} />
        <SelectField
          control={control}
          name="departmentId"
          label={t('fields.department')}
          translate={translate}
          onChange={() => setValue('positionId', '')}
          options={departments.map((d) => ({ value: d.value, label: `${'— '.repeat(d.depth)}${d.label}`, disabled: d.disabled }))}
        />
        <SelectField
          control={control}
          name="positionId"
          label={t('fields.position')}
          translate={translate}
          disabled={!departmentId}
          helper={departmentId ? undefined : t('requisitions.chooseDepartment')}
          // Organization's filter includes sub-departments; a position must belong to this exact department.
          options={(positions.data?.items ?? []).filter((p) => p.department.id === departmentId).map((p) => ({ value: p.id, label: p.title[language], disabled: p.status !== 'active' && p.id !== requisition?.position.id }))}
        />
        <SelectField control={control} name="locationId" label={t('fields.location')} translate={translate} options={(locations.data?.items ?? []).map((l) => ({ value: l.id, label: l.name[language], disabled: l.status !== 'active' && l.id !== requisition?.location.id }))} />
        <SelectField control={control} name="employmentType" label={t('fields.employmentType')} translate={translate} options={EMPLOYMENT_TYPES.map((e) => ({ value: e, label: t(`employmentTypes.${e}`) }))} />
        {number('vacancies', t('fields.vacancies'))}
        {number('minExperienceYears', t('fields.minExperience'))}
        <SelectField control={control} name="education" label={t('fields.education')} translate={translate} options={EDUCATION_LEVELS.map((e) => ({ value: e, label: t(`education.${e}`) }))} />
        <Controller control={control} name="hiringManagerId" render={({ field, fieldState }) => <StaffPicker label={t('fields.hiringManager')} value={field.value} onChange={field.onChange} error={translate(fieldState.error?.message)} known={requisition?.hiringManager ? [requisition.hiringManager] : []} />} />
        <Controller control={control} name="recruiterId" render={({ field, fieldState }) => <StaffPicker label={t('fields.recruiter')} value={field.value} onChange={field.onChange} error={translate(fieldState.error?.message)} known={requisition?.recruiter ? [requisition.recruiter] : []} />} />
        <TextField label={t('fields.openingDate')} type="date" required {...text('openingDate')} slotProps={dateSlot} />
        <TextField label={t('fields.closingDate')} type="date" {...text('closingDate', t('requisitions.closingHint'))} slotProps={dateSlot} />
      </Box>
      <TextField label={t('fields.description')} required multiline minRows={3} {...text('description')} />
      <TextField label={t('fields.skills')} {...text('skills', t('form.listHint'))} />
      <Controller control={control} name="hasSalaryRange" render={({ field }) => <FormControlLabel control={<Checkbox checked={field.value} onChange={(e) => field.onChange(e.target.checked)} />} label={t('requisitions.hasSalaryRange')} />} />
      {hasSalary && (
        <Box sx={{ display: 'grid', gap: 2.5, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr 1fr' } }}>
          {number('salaryMin', t('fields.salaryMin'))}
          {number('salaryMax', t('fields.salaryMax'))}
          <SelectField control={control} name="currency" label={t('fields.currency')} translate={translate} options={CURRENCIES.map((c) => ({ value: c, label: c }))} />
        </Box>
      )}
    </FormDialog>
  );
}
