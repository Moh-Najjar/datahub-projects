import type { FieldValues, Path, UseFormSetError } from 'react-hook-form';
import { isApiError } from '@/core/api/types';
import type { UiStrings } from '@/i18n';

/*
 * Turns API failures into translated text. The (mock) backend sends a machine-readable `reason` (a business rule,
 * e.g. `enrollment.duplicate`) and an error `code`; the translations hold the wording — nothing is hard-coded.
 */

const reasons = (t: UiStrings): Record<string, string> => t.apiReasons;
const codes = (t: UiStrings): Record<string, string> => t.errors;

export function apiErrorMessage(t: UiStrings, error: unknown): string {
  if (isApiError(error)) {
    if (error.reason && reasons(t)[error.reason]) return reasons(t)[error.reason]!;
    // No translation for it: the real backend's actual message (untranslated), else the generic text for the code.
    if (error.detail) return error.detail;
    return codes(t)[error.code] ?? t.errors.generic;
  }
  return t.errors.generic;
}

/** The translated message of one field reason id. */
export const reasonMessage = (t: UiStrings, reason: string): string => reasons(t)[reason] ?? t.errors.VALIDATION;

/**
 * Puts a `VALIDATION` error's field messages on the form's fields. Returns true when at least one field was set
 * (the caller then needs no general error banner).
 */
export function applyServerErrors<T extends FieldValues>(t: UiStrings, error: unknown, setError: UseFormSetError<T>, fields: readonly Path<T>[]): boolean {
  if (!isApiError(error) || error.code !== 'VALIDATION' || !error.fieldErrors) return false;
  let applied = false;
  for (const field of fields) {
    const first = error.fieldErrors[field]?.[0];
    if (first) {
      setError(field, { type: 'server', message: reasonMessage(t, first) });
      applied = true;
    }
  }
  return applied;
}
