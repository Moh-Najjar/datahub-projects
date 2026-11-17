import { useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import FormGroup from '@mui/material/FormGroup';
import FormHelperText from '@mui/material/FormHelperText';
import Paper from '@mui/material/Paper';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm, type Path } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '@/i18n/useLanguage';
import { FormDialog } from '@/modules/shared/FormDialog';
import { arabicInput, latinInput, textFieldProps } from '@/modules/shared/formFields';
import { applyServerErrors } from '@/modules/shared/utils/serverErrors';
import { useCompetencies, useCreateCompetency, useCreateTemplate, useUpdateCompetency, useUpdateRatingScale, useUpdateTemplate } from '@/modules/performance/hooks/usePerformance';
import { competencyFormSchema, templateFormSchema, toCompetencyInput, toTemplateInput, type CompetencyFormValues, type TemplateFormValues } from '@/modules/performance/schemas/performanceSchemas';
import type { Competency, RatingLevel, ReviewTemplate } from '@/modules/performance/types/performance';
import { errorText, fieldErrorText } from '@/modules/performance/utils/serverErrors';

/** Create / edit a competency: code, names, description and rating criteria (configurable guidance). */
export function CompetencyFormDialog({ competency, onClose, onDone }: { competency?: Competency; onClose: () => void; onDone: (c: Competency) => void }) {
  const { t } = useTranslation('performance');
  const { t: tCommon } = useTranslation();
  const create = useCreateCompetency();
  const update = useUpdateCompetency();
  const mutation = competency ? update : create;
  const [formError, setFormError] = useState<string>();
  const { register, handleSubmit, formState, setError } = useForm<CompetencyFormValues>({
    resolver: zodResolver(competencyFormSchema),
    defaultValues: competency ? { code: competency.code, nameEn: competency.name.en, nameAr: competency.name.ar, description: competency.description, criteria: competency.criteria } : { code: '', nameEn: '', nameAr: '', description: '', criteria: '' },
  });
  const translate = (reason: string | undefined) => fieldErrorText(t, reason);
  const text = (name: Path<CompetencyFormValues>, helper?: string) => textFieldProps(register, formState, name, translate, helper);
  const onSubmit = handleSubmit((v) => {
    setFormError(undefined);
    const input = toCompetencyInput(competencyFormSchema.parse(v));
    const callbacks = { onSuccess: onDone, onError: (error: Error) => !applyServerErrors(error, ['code', 'nameEn', 'nameAr', 'description', 'criteria'], setError) && setFormError(errorText(t, tCommon, error)) };
    if (competency) update.mutate({ id: competency.id, input }, callbacks);
    else create.mutate(input, callbacks);
  });
  return (
    <FormDialog open title={competency ? t('competencies.editTitle') : t('competencies.createTitle')} onClose={onClose} onSubmit={onSubmit} submitLabel={competency ? t('actions.save') : t('actions.create')} pending={mutation.isPending} error={formError}>
      <TextField label={t('fields.code')} required {...text('code', t('competencies.codeHint'))} slotProps={latinInput} />
      <Box sx={{ display: 'grid', gap: 2.5, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}>
        <TextField label={t('fields.nameEn')} required {...text('nameEn')} slotProps={latinInput} />
        <TextField label={t('fields.nameAr')} required {...text('nameAr')} slotProps={arabicInput} />
      </Box>
      <TextField label={t('fields.description')} multiline minRows={2} {...text('description')} />
      <TextField label={t('fields.criteria')} multiline minRows={2} {...text('criteria', t('competencies.criteriaHint'))} />
    </FormDialog>
  );
}

/** Review template: a name and the competencies rated in reviews created from it. */
export function TemplateFormDialog({ template, onClose, onDone }: { template?: ReviewTemplate; onClose: () => void; onDone: (tpl: ReviewTemplate) => void }) {
  const { t } = useTranslation('performance');
  const { t: tCommon } = useTranslation();
  const { language } = useLanguage();
  const create = useCreateTemplate();
  const update = useUpdateTemplate();
  const mutation = template ? update : create;
  const competencies = useCompetencies({ page: 1, pageSize: 100, sortBy: 'code', sortDirection: 'asc' });
  const [formError, setFormError] = useState<string>();
  const { register, control, handleSubmit, formState, setError } = useForm<TemplateFormValues>({
    resolver: zodResolver(templateFormSchema),
    defaultValues: template ? { nameEn: template.name.en, nameAr: template.name.ar, competencyIds: template.competencies.map((c) => c.id) } : { nameEn: '', nameAr: '', competencyIds: [] },
  });
  const translate = (reason: string | undefined) => fieldErrorText(t, reason);
  const onSubmit = handleSubmit((v) => {
    setFormError(undefined);
    const input = toTemplateInput(templateFormSchema.parse(v));
    const callbacks = { onSuccess: onDone, onError: (error: Error) => !applyServerErrors(error, ['nameEn', 'nameAr', 'competencyIds'], setError) && setFormError(errorText(t, tCommon, error)) };
    if (template) update.mutate({ id: template.id, input }, callbacks);
    else create.mutate(input, callbacks);
  });
  return (
    <FormDialog open title={template ? t('templates.editTitle') : t('templates.createTitle')} onClose={onClose} onSubmit={onSubmit} submitLabel={template ? t('actions.save') : t('actions.create')} pending={mutation.isPending} error={formError}>
      <Alert severity="info">{t('templates.lockedHint')}</Alert>
      <Box sx={{ display: 'grid', gap: 2.5, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}>
        <TextField label={t('fields.nameEn')} required {...textFieldProps(register, formState, 'nameEn', translate)} slotProps={latinInput} />
        <TextField label={t('fields.nameAr')} required {...textFieldProps(register, formState, 'nameAr', translate)} slotProps={arabicInput} />
      </Box>
      <Controller
        control={control}
        name="competencyIds"
        render={({ field, fieldState }) => (
          <Box component="fieldset" sx={{ border: 0, m: 0, p: 0 }}>
            <Typography component="legend" variant="subtitle2" sx={{ mb: 0.5 }}>
              {t('templates.competencies')}
            </Typography>
            <FormGroup sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}>
              {(competencies.data?.items ?? []).map((c) => (
                <FormControlLabel
                  key={c.id}
                  disabled={c.status !== 'active' && !field.value.includes(c.id)}
                  control={<Checkbox checked={field.value.includes(c.id)} onChange={(e) => field.onChange(e.target.checked ? [...field.value, c.id] : field.value.filter((x) => x !== c.id))} />}
                  label={c.name[language]}
                />
              ))}
            </FormGroup>
            {fieldState.error && <FormHelperText error>{translate(fieldState.error.message)}</FormHelperText>}
          </Box>
        )}
      />
    </FormDialog>
  );
}

/** Labels and descriptions of the rating scale (values 1–5 are fixed). Configurable examples, not a policy. */
export function ScaleDialog({ scale, onClose, onDone }: { scale: RatingLevel[]; onClose: () => void; onDone: () => void }) {
  const { t } = useTranslation('performance');
  const { t: tCommon } = useTranslation();
  const mutation = useUpdateRatingScale();
  const [levels, setLevels] = useState(scale);
  const set = (i: number, key: 'label' | 'description', lang: 'en' | 'ar', value: string) => setLevels((all) => all.map((l, j) => (j === i ? { ...l, [key]: { ...l[key], [lang]: value } } : l)));
  return (
    <FormDialog
      open
      maxWidth="md"
      title={t('scale.editTitle')}
      onClose={onClose}
      onSubmit={(e) => {
        e.preventDefault();
        mutation.mutate(levels, { onSuccess: onDone });
      }}
      submitLabel={t('actions.save')}
      pending={mutation.isPending}
      error={mutation.isError ? errorText(t, tCommon, mutation.error) : undefined}
    >
      <Alert severity="info">{t('scale.hint')}</Alert>
      {levels.map((l, i) => (
        <Paper key={l.value} variant="outlined" sx={{ p: 2, display: 'grid', gap: 1.5, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}>
          <Typography variant="subtitle2" sx={{ gridColumn: '1 / -1' }}>
            {t('scale.level', { value: l.value })}
          </Typography>
          <TextField label={t('fields.labelEn')} required value={l.label.en} onChange={(e) => set(i, 'label', 'en', e.target.value)} slotProps={latinInput} />
          <TextField label={t('fields.labelAr')} required value={l.label.ar} onChange={(e) => set(i, 'label', 'ar', e.target.value)} slotProps={arabicInput} />
          <TextField label={t('fields.descriptionEn')} value={l.description.en} onChange={(e) => set(i, 'description', 'en', e.target.value)} slotProps={latinInput} />
          <TextField label={t('fields.descriptionAr')} value={l.description.ar} onChange={(e) => set(i, 'description', 'ar', e.target.value)} slotProps={arabicInput} />
        </Paper>
      ))}
    </FormDialog>
  );
}
