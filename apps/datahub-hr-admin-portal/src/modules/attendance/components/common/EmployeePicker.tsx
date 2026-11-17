import { useEffect, useState } from 'react';
import Autocomplete from '@mui/material/Autocomplete';
import Box from '@mui/material/Box';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '@/i18n/useLanguage';
import { displayName, useEmployees, type EmployeeSummary } from '@/modules/employees';

interface EmployeePickerProps {
  label: string;
  value: EmployeeSummary | null;
  onChange: (employee: EmployeeSummary | null) => void;
  /** Only active employees (assignments); history and filters may include inactive ones. */
  activeOnly?: boolean;
  error?: string;
  helperText?: string;
  size?: 'small' | 'medium';
  sx?: object;
}

/**
 * Employee search for attendance — through the Employee Management API (its scope rules apply: a Department
 * Manager only finds their team). Searching happens on the server as the user types.
 */
export function EmployeePicker({ label, value, onChange, activeOnly, error, helperText, size, sx }: EmployeePickerProps) {
  const { t } = useTranslation('attendance');
  const { language } = useLanguage();
  const [input, setInput] = useState('');
  const [search, setSearch] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => setSearch(input.trim()), 300);
    return () => clearTimeout(timer);
  }, [input]);
  const query = useEmployees({ page: 1, pageSize: 20, search: search || undefined, sortBy: `name.${language}`, sortDirection: 'asc', filters: activeOnly ? { status: 'active' } : {} });
  const results = query.data?.items ?? [];
  const options = value && !results.some((o) => o.id === value.id) ? [value, ...results] : results;

  return (
    <Autocomplete<EmployeeSummary>
      options={options}
      value={value}
      onChange={(_, option) => onChange(option)}
      onInputChange={(_, v, reason) => reason === 'input' && setInput(v)}
      loading={query.isFetching}
      filterOptions={(list) => list}
      getOptionLabel={(o) => displayName(o.name, language)}
      getOptionKey={(o) => o.id}
      isOptionEqualToValue={(a, b) => a.id === b.id}
      renderOption={({ key, ...props }, o) => (
        <li key={key} {...props}>
          <Box>
            <Typography variant="body2">{displayName(o.name, language)}</Typography>
            <Typography variant="caption" color="text.secondary">
              <span dir="ltr">{o.employeeNumber}</span> · {o.department.name[language]}
            </Typography>
          </Box>
        </li>
      )}
      size={size}
      sx={sx}
      noOptionsText={t('records.employeeSearch')}
      renderInput={(params) => <TextField {...params} label={label} placeholder={t('records.employeeSearch')} error={Boolean(error)} helperText={error ?? helperText} />}
    />
  );
}
