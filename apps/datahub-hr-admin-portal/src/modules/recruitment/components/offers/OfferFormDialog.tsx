import { useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import TextField from '@mui/material/TextField';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, useWatch, type Path } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '@/i18n/useLanguage';
import { useDepartmentOptions, useLocations, usePositions } from '@/modules/organization';
import { FormDialog } from '@/modules/shared/FormDialog';
import { textFieldProps } from '@/modules/shared/formFields';
import { applyServerErrors } from '@/modules/shared/utils/serverErrors';
import { useCreateOffer, useRequisition, useUpdateOffer } from '@/modules/recruitment/hooks/useRecruitment';
import { offerFormSchema, toOfferInput, type OfferFormValues } from '@/modules/recruitment/schemas/recruitmentSchemas';
import { CURRENCIES, EMPLOYMENT_TYPES, type CandidateSummary, type Offer, type Requisition } from '@/modules/recruitment/types/recruitment';
import { formatMoney, personName } from '@/modules/recruitment/utils/format';
import { addDays, todayIso } from '@/modules/recruitment/utils/pipeline';
import { errorText, fieldErrorText } from '@/modules/recruitment/utils/serverErrors';
import { SelectField } from '@/modules/shared/SelectField';

const FIELDS = ['candidateId', 'departmentId', 'positionId', 'locationId', 'salary', 'currency', 'employmentType', 'startDate', 'expiryDate', 'benefits'] as const;

/** Prepare (draft) or edit a draft offer — values default from the requisition. Nothing is e-mailed (simulated). */
export function OfferFormDialog({ candidate, offer, onClose, onDone }: { candidate?: CandidateSummary & { requisition: { id: string } }; offer?: Offer; onClose: () => void; onDone: (o: Offer) => void }) {
  const requisitionId = offer?.requisition.id ?? candidate!.requisition.id;
  const requisition = useRequisition(requisitionId);
  if (!requisition.data) {
    return (
      <Dialog open onClose={onClose} aria-busy="true">
        <Box sx={{ p: 4, display: 'grid', placeItems: 'center' }}>
          <CircularProgress aria-label="…" />
        </Box>
      </Dialog>
    );
  }
  return <OfferForm candidate={offer?.candidate ?? candidate!} offer={offer} requisition={requisition.data} onClose={onClose} onDone={onDone} />;
}

function OfferForm({ candidate, offer, requisition: r, onClose, onDone }: { candidate: CandidateSummary; offer?: Offer; requisition: Requisition; onClose: () => void; onDone: (o: Offer) => void }) {
  const { t } = useTranslation('recruitment');
  const { t: tCommon } = useTranslation();
  const { language } = useLanguage();
  const create = useCreateOffer();
  const update = useUpdateOffer();
  const mutation = offer ? update : create;
  const [formError, setFormError] = useState<string>();
  const range = r.salaryRange;
  const defaults: OfferFormValues = offer
    ? { candidateId: candidate.id, departmentId: offer.department.id, positionId: offer.position.id, locationId: offer.location.id, salary: offer.salary, currency: offer.currency, employmentType: offer.employmentType, startDate: offer.startDate, expiryDate: offer.expiryDate, benefits: offer.benefits }
    : {
        candidateId: candidate.id,
        departmentId: r.department.id,
        positionId: r.position.id,
        locationId: r.location.id,
        salary: range ? Math.round((range.min + range.max) / 20) * 10 : (undefined as never),
        currency: range?.currency ?? 'JOD',
        employmentType: r.employmentType,
        startDate: addDays(todayIso(), 30),
        expiryDate: addDays(todayIso(), 7),
        benefits: '',
      };
  const { register, control, handleSubmit, formState, setError, setValue } = useForm<OfferFormValues>({ resolver: zodResolver(offerFormSchema), defaultValues: defaults });
  const departmentId = useWatch({ control, name: 'departmentId' });
  const { options: departments } = useDepartmentOptions({ keep: defaults.departmentId });
  const positions = usePositions({ page: 1, pageSize: 100, sortBy: `title.${language}`, sortDirection: 'asc', filters: { departmentId } }, Boolean(departmentId));
  const locations = useLocations({ page: 1, pageSize: 100, sortBy: `name.${language}`, sortDirection: 'asc' });
  const translate = (reason: string | undefined) => fieldErrorText(t, reason);
  const text = (name: Path<OfferFormValues>, helper?: string) => textFieldProps(register, formState, name, translate, helper);
  const salary = register('salary', { setValueAs: (v: unknown) => (v === '' ? undefined : Number(v)) });
  const salaryError = translate(formState.errors.salary?.message);
  const dateSlot = { inputLabel: { shrink: true }, htmlInput: { dir: 'ltr' } } as const;

  const onSubmit = handleSubmit((v) => {
    setFormError(undefined);
    const input = toOfferInput(offerFormSchema.parse(v));
    const callbacks = {
      onSuccess: onDone,
      onError: (error: Error) => {
        if (!applyServerErrors(error, FIELDS, setError)) setFormError(errorText(t, tCommon, error));
      },
    };
    if (offer) update.mutate({ id: offer.id, input }, callbacks);
    else create.mutate(input, callbacks);
  });

  return (
    <FormDialog open maxWidth="md" title={offer ? t('offers.editTitle', { number: offer.number }) : t('offers.createTitle', { name: personName(candidate.name, language) })} onClose={onClose} onSubmit={onSubmit} submitLabel={offer ? t('actions.save') : t('actions.saveDraft')} pending={mutation.isPending} error={formError}>
      <Alert severity="info">{t('offers.draftNote')}</Alert>
      <Box sx={{ display: 'grid', gap: 2.5, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}>
        <TextField label={t('fields.candidate')} value={`${personName(candidate.name, language)} (${candidate.number})`} slotProps={{ input: { readOnly: true } }} />
        <TextField label={t('fields.requisition')} value={`${r.number} · ${r.title[language]}`} slotProps={{ input: { readOnly: true } }} />
        <SelectField control={control} name="departmentId" label={t('fields.department')} translate={translate} onChange={() => setValue('positionId', '')} options={departments.map((d) => ({ value: d.value, label: `${'— '.repeat(d.depth)}${d.label}`, disabled: d.disabled }))} />
        <SelectField control={control} name="positionId" label={t('fields.position')} translate={translate} disabled={!departmentId} // Organization's filter includes sub-departments; a position must belong to this exact department.
          options={(positions.data?.items ?? []).filter((p) => p.department.id === departmentId).map((p) => ({ value: p.id, label: p.title[language], disabled: p.status !== 'active' }))} />
        <SelectField control={control} name="locationId" label={t('fields.location')} translate={translate} options={(locations.data?.items ?? []).map((l) => ({ value: l.id, label: l.name[language], disabled: l.status !== 'active' }))} />
        <SelectField control={control} name="employmentType" label={t('fields.employmentType')} translate={translate} options={EMPLOYMENT_TYPES.map((e) => ({ value: e, label: t(`employmentTypes.${e}`) }))} />
        <TextField
          type="number"
          label={t('fields.salary')}
          required
          {...salary}
          inputRef={salary.ref}
          error={Boolean(salaryError)}
          helperText={salaryError ?? (range ? t('offers.rangeHint', { range: `${formatMoney(range.min, range.currency, language)} – ${formatMoney(range.max, range.currency, language)}` }) : t('offers.monthlyHint'))}
          slotProps={{ htmlInput: { dir: 'ltr', min: 0 } }}
        />
        <SelectField control={control} name="currency" label={t('fields.currency')} translate={translate} options={CURRENCIES.map((c) => ({ value: c, label: c }))} />
        <TextField label={t('fields.startDate')} type="date" required {...text('startDate')} slotProps={dateSlot} />
        <TextField label={t('fields.expiryDate')} type="date" required {...text('expiryDate', t('offers.expiryHint'))} slotProps={dateSlot} />
      </Box>
      <TextField label={t('fields.benefits')} multiline minRows={2} {...text('benefits')} />
    </FormDialog>
  );
}
