import type { FieldValues, FormState, Path, UseFormRegister } from 'react-hook-form';

/**
 * Props that bind an MUI `TextField` to a React Hook Form field: registration, translated error text
 * (schema or backend reason) and the default helper text.
 */
export function textFieldProps<T extends FieldValues>(
  register: UseFormRegister<T>,
  formState: FormState<T>,
  name: Path<T>,
  /** Translates a field error reason (schema or backend). */
  translateError: (reason: string | undefined) => string | undefined,
  helperText?: string,
) {
  const { ref, ...field } = register(name);
  const message = formState.errors[name]?.message;
  const error = translateError(typeof message === 'string' ? message : undefined);
  return { ...field, inputRef: ref, error: Boolean(error), helperText: error ?? helperText };
}

/** Arabic text inputs: right-to-left whatever the UI language. */
export const arabicInput = { htmlInput: { dir: 'rtl', lang: 'ar' } } as const;
/** Codes and English text: left-to-right whatever the UI language. */
export const latinInput = { htmlInput: { dir: 'ltr', lang: 'en' } } as const;
