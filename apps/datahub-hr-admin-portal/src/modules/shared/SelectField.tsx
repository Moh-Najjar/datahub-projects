/** MUI select bound to React Hook Form, with translated errors (shared by module forms). */
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import { Controller, type Control, type FieldValues, type Path } from 'react-hook-form';

interface SelectFieldProps<T extends FieldValues> {
  control: Control<T>;
  name: Path<T>;
  label: string;
  options: ReadonlyArray<{ value: string; label: string; disabled?: boolean }>;
  translate: (reason: string | undefined) => string | undefined;
  disabled?: boolean;
  helper?: string;
  onChange?: (value: string) => void;
}

/** MUI select bound to React Hook Form, with translated errors. */
export function SelectField<T extends FieldValues>({ control, name, label, options, translate, disabled, helper, onChange }: SelectFieldProps<T>) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <TextField
          select
          required
          label={label}
          value={(field.value as string) ?? ''}
          onChange={(e) => {
            field.onChange(e.target.value);
            onChange?.(e.target.value);
          }}
          onBlur={field.onBlur}
          inputRef={field.ref}
          disabled={disabled}
          error={Boolean(fieldState.error)}
          helperText={translate(fieldState.error?.message) ?? helper}
        >
          {options.map((o) => (
            <MenuItem key={o.value} value={o.value} disabled={o.disabled}>
              {o.label}
            </MenuItem>
          ))}
        </TextField>
      )}
    />
  );
}
