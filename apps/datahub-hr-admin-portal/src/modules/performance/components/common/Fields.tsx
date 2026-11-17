import { useEffect, useMemo, useState } from 'react';
import Autocomplete from '@mui/material/Autocomplete';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '@/i18n/useLanguage';
import { useEmployeeOptions, useRatingScale } from '@/modules/performance/hooks/usePerformance';
import type { EmployeeOption, EmployeeRef } from '@/modules/performance/types/performance';

/**
 * Rating on the CONFIGURED scale (labels come from the API), as a select: reads the same in LTR and RTL and is fully
 * keyboard accessible. `null` = not rated yet.
 */
export function RatingSelect({ label, value, onChange, error, disabled, required, size }: { label: string; value: number | null; onChange: (v: number | null) => void; error?: string; disabled?: boolean; required?: boolean; size?: 'small' | 'medium' }) {
  const { t } = useTranslation('performance');
  const { language } = useLanguage();
  const scale = useRatingScale();
  return (
    <TextField
      select
      size={size}
      label={label}
      required={required}
      disabled={disabled}
      value={value === null ? '' : String(value)}
      onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
      error={Boolean(error)}
      helperText={error}
      sx={{ minWidth: 220 }}
    >
      <MenuItem value="">
        <em>{t('rating.notRated')}</em>
      </MenuItem>
      {(scale.data ?? []).map((l) => (
        <MenuItem key={l.value} value={String(l.value)}>
          {l.value} — {l.label[language]}
        </MenuItem>
      ))}
    </TextField>
  );
}

function useSearch() {
  const [input, setInput] = useState('');
  const [search, setSearch] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => setSearch(input.trim()), 300);
    return () => clearTimeout(timer);
  }, [input]);
  return { search, setInput };
}

/** One employee the caller may manage (server-side search through the Performance API, scope applied). */
export function EmployeeOptionPicker({ label, value, onChange, error, known, purpose = 'manage', disabled }: { label: string; value: string; onChange: (id: string) => void; error?: string; known?: EmployeeRef | null; purpose?: 'manage' | 'participants'; disabled?: boolean }) {
  const { t } = useTranslation('performance');
  const { language } = useLanguage();
  const { search, setInput } = useSearch();
  const query = useEmployeeOptions(search, purpose, !disabled);
  const options = useMemo(() => {
    const results = query.data ?? [];
    return known && !results.some((r) => r.id === known.id) ? [known, ...results] : results;
  }, [query.data, known]);
  return (
    <Autocomplete<EmployeeOption>
      options={options}
      disabled={disabled}
      value={options.find((o) => o.id === value) ?? null}
      onChange={(_, o) => onChange(o?.id ?? '')}
      onInputChange={(_, v, reason) => reason === 'input' && setInput(v)}
      filterOptions={(o) => o}
      loading={query.isFetching}
      getOptionLabel={(o) => `${o.name[language]}${o.employeeNumber ? ` (${o.employeeNumber})` : ''}`}
      getOptionKey={(o) => o.id}
      isOptionEqualToValue={(a, b) => a.id === b.id}
      noOptionsText={t('picker.noResults')}
      renderInput={(params) => <TextField {...params} required label={label} error={Boolean(error)} helperText={error} />}
    />
  );
}

/** Several employees (cycle participants). */
export function EmployeeMultiPicker({ label, value, onChange }: { label: string; value: EmployeeOption[]; onChange: (list: EmployeeOption[]) => void }) {
  const { t } = useTranslation('performance');
  const { language } = useLanguage();
  const { search, setInput } = useSearch();
  const query = useEmployeeOptions(search, 'participants');
  return (
    <Autocomplete<EmployeeOption, true>
      multiple
      options={query.data ?? []}
      value={value}
      onChange={(_, list) => onChange(list)}
      onInputChange={(_, v, reason) => reason === 'input' && setInput(v)}
      filterOptions={(o) => o}
      loading={query.isFetching}
      getOptionLabel={(o) => `${o.name[language]} (${o.employeeNumber})`}
      getOptionKey={(o) => o.id}
      isOptionEqualToValue={(a, b) => a.id === b.id}
      noOptionsText={t('picker.noResults')}
      renderInput={(params) => <TextField {...params} label={label} />}
    />
  );
}
