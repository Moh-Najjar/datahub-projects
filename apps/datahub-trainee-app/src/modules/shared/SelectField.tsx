import type { ReactNode } from 'react';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import { Controller, type Control, type FieldPath, type FieldValues } from 'react-hook-form';

interface SelectFieldProps<T extends FieldValues> {
  control: Control<T>;
  name: FieldPath<T>;
  label: string;
  options: readonly { value: string; label: ReactNode; disabled?: boolean }[];
  required?: boolean;
  disabled?: boolean;
  helperText?: string;
  /** Adds an empty first choice with this label (for optional selects). */
  emptyLabel?: string;
  /** Called with the chosen value after the form field was updated (e.g. to keep a dependent field in step). */
  onValueChange?: (value: string) => void;
}

/** A React-Hook-Form-bound MUI select that shows the field's validation message. */
export function SelectField<T extends FieldValues>({ control, name, label, options, required, disabled, helperText, emptyLabel, onValueChange }: SelectFieldProps<T>) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <TextField
          select
          label={label}
          required={required}
          disabled={disabled}
          value={field.value ?? ''}
          onChange={(e) => {
            field.onChange(e.target.value);
            onValueChange?.(e.target.value);
          }}
          onBlur={field.onBlur}
          inputRef={field.ref}
          error={!!fieldState.error}
          helperText={fieldState.error?.message ?? helperText}
          slotProps={{ inputLabel: { shrink: true }, select: { displayEmpty: true } }}
        >
          {emptyLabel !== undefined && <MenuItem value="">{emptyLabel}</MenuItem>}
          {options.map((option) => (
            <MenuItem key={option.value} value={option.value} disabled={option.disabled}>
              {option.label}
            </MenuItem>
          ))}
        </TextField>
      )}
    />
  );
}
