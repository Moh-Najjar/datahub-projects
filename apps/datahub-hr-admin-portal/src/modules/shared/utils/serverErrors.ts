import type { FieldValues, Path, UseFormSetError } from 'react-hook-form';
import { isApiError } from '@/core/api/types';

/**
 * Copies the backend's field errors (`ApiError` `VALIDATION` + `fieldErrors`) onto the form's fields; the first
 * one gets focus. Returns true when at least one field received an error (otherwise show a general message).
 * Each module translates the reasons with its own namespace.
 */
export function applyServerErrors<T extends FieldValues>(error: unknown, fields: readonly Path<T>[], setError: UseFormSetError<T>): boolean {
  if (!isApiError(error) || error.code !== 'VALIDATION' || !error.fieldErrors) return false;
  let applied = false;
  for (const [field, reasons] of Object.entries(error.fieldErrors)) {
    if (!(fields as readonly string[]).includes(field) || !reasons[0]) continue;
    setError(field as Path<T>, { type: 'server', message: reasons[0] }, { shouldFocus: !applied });
    applied = true;
  }
  return applied;
}

/** The first business-rule reason of a `VALIDATION` error that is not tied to a form field (e.g. `status`). */
export function serverReason(error: unknown, field = 'status'): string | undefined {
  return isApiError(error) && error.code === 'VALIDATION' ? error.fieldErrors?.[field]?.[0] : undefined;
}
