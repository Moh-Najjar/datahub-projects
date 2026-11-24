import type { ReactNode } from 'react';
import Button from '@mui/material/Button';
import FormControl from '@mui/material/FormControl';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import ClearIcon from '@mui/icons-material/Clear';
import SearchIcon from '@mui/icons-material/Search';
import { useT } from '@/i18n/useT';

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  /** Accessible name (defaults to the placeholder). */
  label?: string;
}

/** Search box with a clear button. The parent debounces (see `useListState`). */
export function SearchInput({ value, onChange, placeholder, label }: SearchInputProps) {
  const t = useT();
  return (
    <TextField
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      type="search"
      slotProps={{
        htmlInput: { 'aria-label': label ?? placeholder },
        input: {
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon fontSize="small" />
            </InputAdornment>
          ),
          endAdornment: value ? (
            <InputAdornment position="end">
              <IconButton size="small" edge="end" aria-label={t.common.clear} onClick={() => onChange('')}>
                <ClearIcon fontSize="small" />
              </IconButton>
            </InputAdornment>
          ) : undefined,
        },
      }}
      sx={{ minWidth: { sm: 280 }, flex: { sm: '1 1 280px' }, maxWidth: { sm: 420 } }}
    />
  );
}

interface FilterSelectProps<V extends string> {
  label: string;
  value: V | undefined;
  options: readonly { value: V; label: string }[];
  onChange: (value: V | undefined) => void;
  /** Text of the "no filter" choice (default "All"). */
  allLabel?: string;
  minWidth?: number;
}

/** A single-choice filter with an "All" option. */
export function FilterSelect<V extends string>({ label, value, options, onChange, allLabel, minWidth = 170 }: FilterSelectProps<V>) {
  const t = useT();
  const id = `filter-${label.replace(/\W+/g, '-')}`;
  return (
    <FormControl size="small" sx={{ minWidth }}>
      <InputLabel id={`${id}-label`} shrink>
        {label}
      </InputLabel>
      <Select labelId={`${id}-label`} id={id} label={label} value={value ?? ''} displayEmpty notched onChange={(e) => onChange((e.target.value as V | '') || undefined)}>
        <MenuItem value="">{allLabel ?? t.common.all}</MenuItem>
        {options.map((option) => (
          <MenuItem key={option.value} value={option.value}>
            {option.label}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
}

interface FilterBarProps {
  search: ReactNode;
  filters?: ReactNode;
  /** Trailing content, e.g. a view toggle. */
  trailing?: ReactNode;
  hasActiveFilters?: boolean;
  onClear?: () => void;
}

/** One row (wrapping on small screens) for the search box, the filters and a "Clear" button. */
export function FilterBar({ search, filters, trailing, hasActiveFilters, onClear }: FilterBarProps) {
  const t = useT();
  return (
    <Stack direction="row" spacing={1.5} useFlexGap sx={{ alignItems: 'center', flexWrap: 'wrap', mb: 2 }}>
      {search}
      {filters}
      {hasActiveFilters && onClear && (
        <Button size="small" onClick={onClear} startIcon={<ClearIcon />}>
          {t.common.clearFilters}
        </Button>
      )}
      {trailing && <Stack direction="row" spacing={1} sx={{ marginInlineStart: 'auto' }}>{trailing}</Stack>}
    </Stack>
  );
}
