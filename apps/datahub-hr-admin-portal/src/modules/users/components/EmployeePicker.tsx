import { useState } from 'react';
import Autocomplete from '@mui/material/Autocomplete';
import TextField from '@mui/material/TextField';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '@/i18n/useLanguage';
import { useEmployeeSearch, type EmployeeChoice } from '@/modules/users/hooks/useEmployeeSearch';

/** Search an ACTIVE employee by name or number (Employee Management's directory; server-side search). */
export function EmployeePicker({ value, onChange, error, disabled }: { value: EmployeeChoice | null; onChange: (v: EmployeeChoice | null) => void; error?: string; disabled?: boolean }) {
  const { t } = useTranslation('users');
  const { language } = useLanguage();
  const [search, setSearch] = useState('');
  const options = useEmployeeSearch(search);
  const label = (o: EmployeeChoice) => `${o.name[language]} · ${o.employeeNumber}`;
  return (
    <Autocomplete
      options={options.data ?? []}
      value={value}
      disabled={disabled}
      loading={options.isFetching}
      filterOptions={(x) => x}
      isOptionEqualToValue={(a, b) => a.id === b.id}
      getOptionLabel={label}
      onInputChange={(_, v, reason) => reason === 'input' && setSearch(v)}
      onChange={(_, v) => onChange(v)}
      renderInput={(params) => <TextField {...params} label={t('form.employee')} placeholder={t('form.noEmployee')} error={Boolean(error)} helperText={error ?? t('form.employeeHint')} />}
    />
  );
}
