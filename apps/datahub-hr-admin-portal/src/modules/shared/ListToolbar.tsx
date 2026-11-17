import type { ReactNode } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import InputAdornment from '@mui/material/InputAdornment';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import AddOutlined from '@mui/icons-material/AddOutlined';
import SearchOutlined from '@mui/icons-material/SearchOutlined';
import { useTranslation } from 'react-i18next';

interface ListToolbarProps {
  search: string;
  onSearch: (value: string) => void;
  searchLabel: string;
  /** Filter controls (`FilterSelect`s). */
  filters?: ReactNode;
  hasFilters: boolean;
  onClear: () => void;
  /** Primary "create" action, shown only to roles that may create. */
  createLabel?: string;
  onCreate?: () => void;
}

/** Search, filters and the create button above a list. Wraps onto several lines on narrow screens. */
export function ListToolbar({ search, onSearch, searchLabel, filters, hasFilters, onClear, createLabel, onCreate }: ListToolbarProps) {
  const { t } = useTranslation();
  return (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1.5, mb: 2 }}>
      <TextField
        type="search"
        size="small"
        label={t('list.search')}
        placeholder={searchLabel}
        value={search}
        onChange={(e) => onSearch(e.target.value)}
        sx={{ flex: '1 1 240px', minWidth: 0, maxWidth: { sm: 360 } }}
        slotProps={{
          input: {
            startAdornment: (
              <InputAdornment position="start">
                <SearchOutlined fontSize="small" />
              </InputAdornment>
            ),
          },
        }}
      />
      {filters}
      {hasFilters && (
        <Button size="small" onClick={onClear}>
          {t('list.clearFilters')}
        </Button>
      )}
      {onCreate && createLabel && (
        <Button variant="contained" startIcon={<AddOutlined />} onClick={onCreate} sx={{ ml: { sm: 'auto' } }}>
          {createLabel}
        </Button>
      )}
    </Box>
  );
}

interface FilterSelectProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  /** Label of the "no filter" option. */
  allLabel: string;
  options: ReadonlyArray<{ value: string; label: string; depth?: number }>;
}

/** A small select whose first option clears the filter. */
export function FilterSelect({ label, value, onChange, allLabel, options }: FilterSelectProps) {
  return (
    <TextField select size="small" label={label} value={value} onChange={(e) => onChange(e.target.value)} sx={{ flex: '1 1 160px', minWidth: 150, maxWidth: { sm: 240 } }}>
      <MenuItem value="">{allLabel}</MenuItem>
      {options.map((o) => (
        <MenuItem key={o.value} value={o.value} sx={{ pl: 2 + (o.depth ?? 0) * 2 }}>
          {o.label}
        </MenuItem>
      ))}
    </TextField>
  );
}
