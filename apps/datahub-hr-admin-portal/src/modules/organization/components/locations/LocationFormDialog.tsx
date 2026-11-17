import { useMemo, useState } from 'react';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '@/i18n/useLanguage';
import { useCreateLocation, useUpdateLocation } from '@/modules/organization/hooks/useOrganization';
import { locationFormSchema, toLocationInput, type LocationFormValues } from '@/modules/organization/schemas/organizationSchemas';
import type { Location } from '@/modules/organization/types/organization';
import { countryName, LOCATION_COUNTRIES } from '@/modules/organization/utils/countries';
import { applyServerErrors, errorText, fieldErrorText } from '@/modules/organization/utils/serverErrors';
import { FormDialog } from '@/modules/shared/FormDialog';
import { arabicInput, latinInput, textFieldProps } from '@/modules/shared/formFields';

const FIELDS = ['code', 'nameEn', 'nameAr', 'address', 'city', 'country'] as const;

/** Create / edit a location. Mount it only while open. */
export function LocationFormDialog({ location, onClose, onSaved }: { location?: Location; onClose: () => void; onSaved: (created: boolean) => void }) {
  const { t } = useTranslation('organization');
  const { t: tCommon } = useTranslation();
  const { language } = useLanguage();
  const create = useCreateLocation();
  const update = useUpdateLocation();
  const [formError, setFormError] = useState<string>();
  const countries = useMemo(
    () => LOCATION_COUNTRIES.map((code) => ({ code, name: countryName(code, language) })).sort((a, b) => a.name.localeCompare(b.name, language)),
    [language],
  );

  const { register, control, handleSubmit, formState, setError } = useForm<LocationFormValues>({
    resolver: zodResolver(locationFormSchema),
    defaultValues: {
      code: location?.code ?? '',
      nameEn: location?.name.en ?? '',
      nameAr: location?.name.ar ?? '',
      address: location?.address ?? '',
      city: location?.city ?? '',
      country: (location?.country ?? '') as LocationFormValues['country'],
    },
  });
  const field = (name: (typeof FIELDS)[number], helper?: string) => textFieldProps(register, formState, name, (reason) => fieldErrorText(t, reason), helper);

  const onSubmit = handleSubmit((values) => {
    setFormError(undefined);
    const input = toLocationInput(locationFormSchema.parse(values));
    const handlers = {
      onSuccess: () => onSaved(!location),
      onError: (error: Error) => {
        if (!applyServerErrors(error, FIELDS, setError)) setFormError(errorText(t, tCommon, error));
      },
    };
    if (location) update.mutate({ id: location.id, input }, handlers);
    else create.mutate(input, handlers);
  });

  return (
    <FormDialog
      open
      title={location ? t('forms.editLocationTitle') : t('forms.createLocationTitle')}
      onClose={onClose}
      onSubmit={onSubmit}
      submitLabel={location ? t('actions.save') : t('actions.create')}
      pending={create.isPending || update.isPending}
      error={formError}
    >
      <TextField label={t('fields.code')} required autoFocus {...field('code', t('forms.codeHint'))} slotProps={latinInput} />
      <TextField label={t('fields.nameEn')} required {...field('nameEn')} slotProps={latinInput} />
      <TextField label={t('fields.nameAr')} required {...field('nameAr')} slotProps={arabicInput} />
      <TextField label={t('fields.address')} required {...field('address')} />
      <TextField label={t('fields.city')} required {...field('city')} />
      <Controller
        control={control}
        name="country"
        render={({ field: country, fieldState }) => (
          <TextField
            select
            required
            label={t('fields.country')}
            value={country.value}
            onChange={country.onChange}
            onBlur={country.onBlur}
            inputRef={country.ref}
            error={Boolean(fieldState.error)}
            helperText={fieldErrorText(t, fieldState.error?.message)}
          >
            <MenuItem value="" disabled>
              {t('forms.selectCountry')}
            </MenuItem>
            {countries.map((c) => (
              <MenuItem key={c.code} value={c.code}>
                {c.name}
              </MenuItem>
            ))}
          </TextField>
        )}
      />
    </FormDialog>
  );
}
