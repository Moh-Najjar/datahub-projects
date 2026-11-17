import { useEffect, useState } from 'react';
import Autocomplete from '@mui/material/Autocomplete';
import Box from '@mui/material/Box';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { Controller, type Control, type FieldValues, type Path } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '@/i18n/useLanguage';
import { useManagerOptions } from '@/modules/organization/hooks/useOrganization';
import type { ManagerOption, NamedRef } from '@/modules/organization/types/organization';
import { fieldErrorText } from '@/modules/organization/utils/serverErrors';

/**
 * Searchable person picker bound to a form field holding the manager id ('' = none). People are active
 * employees, searched on the server as the user types (the list can be long). `current` is the saved manager,
 * so it is shown even when it is not in the latest search results.
 */
export function ManagerField<T extends FieldValues>({ control, name, current }: { control: Control<T>; name: Path<T>; current?: NamedRef | null }) {
  const { t } = useTranslation('organization');
  const { language } = useLanguage();
  const [input, setInput] = useState('');
  const [search, setSearch] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => setSearch(input.trim()), 300);
    return () => clearTimeout(timer);
  }, [input]);
  const query = useManagerOptions(search);
  const results = query.data ?? [];
  const saved: ManagerOption | null = current ? { id: current.id, name: current.name, jobTitle: { en: '', ar: '' } } : null;
  const options = saved && !results.some((o) => o.id === saved.id) ? [saved, ...results] : results;

  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <Autocomplete<ManagerOption>
          options={options}
          loading={query.isFetching}
          value={options.find((o) => o.id === field.value) ?? null}
          onChange={(_, option) => field.onChange(option?.id ?? '')}
          onInputChange={(_, value, reason) => reason === 'input' && setInput(value)}
          onBlur={field.onBlur}
          getOptionLabel={(o) => o.name[language]}
          getOptionKey={(o) => o.id}
          isOptionEqualToValue={(a, b) => a.id === b.id}
          // Filtering happens on the server.
          filterOptions={(list) => list}
          renderOption={({ key, ...props }, o) => (
            <li key={key} {...props}>
              <Box>
                <Typography variant="body2">{o.name[language]}</Typography>
                {o.jobTitle[language] && (
                  <Typography variant="caption" color="text.secondary">
                    {o.jobTitle[language]}
                  </Typography>
                )}
              </Box>
            </li>
          )}
          loadingText={t('forms.loadingOptions')}
          noOptionsText={t('forms.noOptions')}
          renderInput={(params) => (
            <TextField
              {...params}
              inputRef={field.ref}
              label={t('fields.manager')}
              placeholder={t('forms.managerSearch')}
              error={Boolean(fieldState.error)}
              helperText={fieldErrorText(t, fieldState.error?.message) ?? t('forms.managerHint')}
            />
          )}
        />
      )}
    />
  );
}
