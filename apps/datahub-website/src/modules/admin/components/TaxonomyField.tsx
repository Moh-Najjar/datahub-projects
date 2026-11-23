import Autocomplete from '@mui/material/Autocomplete';
import Chip from '@mui/material/Chip';
import TextField from '@mui/material/TextField';
import type { BlogTerm } from '@/core/types/blog';

interface TaxonomyFieldProps {
  label: string;
  helperText: string;
  /** The backend's list (`GET /api/blogs/categories` / `tags`). */
  options: readonly BlogTerm[];
  /** The post's own terms: their names show even before the list has loaded. */
  known?: readonly BlogTerm[];
  loading: boolean;
  /** Selected ids. */
  value: string[];
  onChange: (ids: string[]) => void;
  onBlur: () => void;
  error?: string;
}

/** Categories or tags of a post: several chosen from the backend's list (no new ones — they are created in the backend). */
export function TaxonomyField({ label, helperText, options, known = [], loading, value, onChange, onBlur, error }: TaxonomyFieldProps) {
  const byId = new Map<string, BlogTerm>([...known, ...options].map((term) => [term.id, term]));
  const all = [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
  const selected = value.map((id) => byId.get(id) ?? { id, name: id, slug: id });

  return (
    <Autocomplete
      multiple
      options={all}
      value={selected}
      loading={loading}
      filterSelectedOptions
      isOptionEqualToValue={(option, v) => option.id === v.id}
      getOptionLabel={(option) => option.name}
      onChange={(_, next) => onChange(next.map((term) => term.id))}
      onBlur={onBlur}
      renderValue={(terms, getItemProps) => terms.map((term, index) => <Chip size="small" label={term.name} {...getItemProps({ index })} key={term.id} />)}
      renderInput={(params) => <TextField {...params} label={label} error={Boolean(error)} helperText={error ?? helperText} />}
    />
  );
}
