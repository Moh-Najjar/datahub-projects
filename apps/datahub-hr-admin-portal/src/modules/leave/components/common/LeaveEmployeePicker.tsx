import { useEffect, useMemo, useState } from 'react';
import Autocomplete from '@mui/material/Autocomplete';
import Box from '@mui/material/Box';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import type { Localized } from '@datahub/shared-types';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '@/i18n/useLanguage';
import { useLeaveBalances } from '@/modules/leave/hooks/useLeave';

export interface LeaveEmployee {
  id: string;
  name: Localized<string>;
  employeeNumber: string;
}

interface Props {
  label: string;
  value: LeaveEmployee | null;
  onChange: (employee: LeaveEmployee | null) => void;
  size?: 'small' | 'medium';
  sx?: object;
}

/**
 * Employee search for leave filters, through the LEAVE API (balances of the current year): it returns exactly the
 * employees the caller may see in Leave (organization or team), searched on the server as the user types.
 */
export function LeaveEmployeePicker({ label, value, onChange, size, sx }: Props) {
  const { t } = useTranslation('leave');
  const { language } = useLanguage();
  const [input, setInput] = useState('');
  const [search, setSearch] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => setSearch(input.trim()), 300);
    return () => clearTimeout(timer);
  }, [input]);
  const query = useLeaveBalances({ page: 1, pageSize: 100, search: search || undefined, sortBy: `employee.name.${language}`, sortDirection: 'asc' });
  const results = useMemo(() => {
    const seen = new Map<string, LeaveEmployee>();
    for (const b of query.data?.items ?? []) if (!seen.has(b.employeeId)) seen.set(b.employeeId, { id: b.employeeId, name: b.employee.name, employeeNumber: b.employee.employeeNumber });
    return [...seen.values()].slice(0, 20);
  }, [query.data]);
  const options = value && !results.some((o) => o.id === value.id) ? [value, ...results] : results;

  return (
    <Autocomplete<LeaveEmployee>
      size={size}
      sx={sx}
      options={options}
      value={value}
      onChange={(_, next) => onChange(next)}
      inputValue={input}
      onInputChange={(_, next) => setInput(next)}
      filterOptions={(o) => o}
      loading={query.isFetching}
      isOptionEqualToValue={(a, b) => a.id === b.id}
      getOptionLabel={(o) => o.name[language]}
      noOptionsText={t('picker.noResults')}
      loadingText={t('picker.loading')}
      renderOption={({ key, ...props }, o) => (
        <Box component="li" key={key} {...props} sx={{ display: 'flex', justifyContent: 'space-between', gap: 2 }}>
          <span>{o.name[language]}</span>
          <Typography component="span" variant="caption" color="text.secondary" dir="ltr" sx={{ fontFamily: 'monospace' }}>
            {o.employeeNumber}
          </Typography>
        </Box>
      )}
      renderInput={(params) => <TextField {...params} label={label} />}
    />
  );
}
