import { useEffect, useMemo, useState } from 'react';
import Autocomplete from '@mui/material/Autocomplete';
import Box from '@mui/material/Box';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '@/i18n/useLanguage';
import { useStaffOptions } from '@/modules/recruitment/hooks/useRecruitment';
import type { NamedRef, StaffOption } from '@/modules/recruitment/types/recruitment';

interface CommonProps {
  label: string;
  error?: string;
  helperText?: string;
  required?: boolean;
  /** Already-selected people (to display their names before a search returns them). */
  known?: readonly NamedRef[];
}

const asOption = (p: NamedRef): StaffOption => ({ id: p.id, name: p.name, employeeNumber: '', department: { id: '', name: { en: '', ar: '' } }, position: { id: '', name: { en: '', ar: '' } } });

function useSearch() {
  const [input, setInput] = useState('');
  const [search, setSearch] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => setSearch(input.trim()), 300);
    return () => clearTimeout(timer);
  }, [input]);
  return { search, setInput };
}

/** One option row: name, then number · position · department. */
function StaffRow({ liProps, option: o, language }: { liProps: React.HTMLAttributes<HTMLLIElement>; option: StaffOption; language: 'en' | 'ar' }) {
  return (
    <Box component="li" {...liProps} sx={{ display: 'block !important' }}>
      <Typography variant="body2">{o.name[language]}</Typography>
      {o.employeeNumber && (
        <Typography variant="caption" color="text.secondary">
          <span dir="ltr">{o.employeeNumber}</span> · {o.position.name[language]} · {o.department.name[language]}
        </Typography>
      )}
    </Box>
  );
}

/** One employee (hiring manager / recruiter), searched on the server through the Recruitment API. */
export function StaffPicker({ value, onChange, label, error, helperText, required, known = [] }: CommonProps & { value: string; onChange: (id: string) => void }) {
  const { t } = useTranslation('recruitment');
  const { language } = useLanguage();
  const { search, setInput } = useSearch();
  const query = useStaffOptions(search);
  const options = useMemo(() => {
    const results = query.data ?? [];
    const extra = known.filter((k) => !results.some((r) => r.id === k.id)).map(asOption);
    return [...extra, ...results];
  }, [query.data, known]);
  return (
    <Autocomplete<StaffOption>
      options={options}
      value={options.find((o) => o.id === value) ?? null}
      onChange={(_, o) => onChange(o?.id ?? '')}
      onInputChange={(_, v, reason) => reason === 'input' && setInput(v)}
      filterOptions={(o) => o}
      loading={query.isFetching}
      getOptionLabel={(o) => o.name[language]}
      getOptionKey={(o) => o.id}
      isOptionEqualToValue={(a, b) => a.id === b.id}
      noOptionsText={t('picker.noResults')}
      renderOption={({ key, ...props }, o) => <StaffRow key={key} liProps={props} option={o} language={language} />}
      renderInput={(params) => <TextField {...params} label={label} required={required} error={Boolean(error)} helperText={error ?? helperText} />}
    />
  );
}

/** Several employees (interviewers). */
export function StaffMultiPicker({ value, onChange, label, error, helperText, required, known = [] }: CommonProps & { value: string[]; onChange: (ids: string[]) => void }) {
  const { t } = useTranslation('recruitment');
  const { language } = useLanguage();
  const { search, setInput } = useSearch();
  const query = useStaffOptions(search);
  const options = useMemo(() => {
    const results = query.data ?? [];
    const extra = known.filter((k) => !results.some((r) => r.id === k.id)).map(asOption);
    return [...extra, ...results];
  }, [query.data, known]);
  const selected = value.map((id) => options.find((o) => o.id === id) ?? asOption({ id, name: { en: id, ar: id } }));
  return (
    <Autocomplete<StaffOption, true>
      multiple
      options={options}
      value={selected}
      onChange={(_, list) => onChange(list.map((o) => o.id))}
      onInputChange={(_, v, reason) => reason === 'input' && setInput(v)}
      filterOptions={(o) => o}
      loading={query.isFetching}
      getOptionLabel={(o) => o.name[language]}
      getOptionKey={(o) => o.id}
      isOptionEqualToValue={(a, b) => a.id === b.id}
      noOptionsText={t('picker.noResults')}
      renderOption={({ key, ...props }, o) => <StaffRow key={key} liProps={props} option={o} language={language} />}
      renderInput={(params) => <TextField {...params} label={label} required={required} error={Boolean(error)} helperText={error ?? helperText} />}
    />
  );
}
