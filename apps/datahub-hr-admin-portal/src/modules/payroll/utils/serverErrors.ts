import type { TFunction } from 'i18next';
import { isApiError } from '@/core/api/types';

type PayrollT = TFunction<'payroll'>;

/** Translates a field error: a backend reason (`serverErrors.*`) or a schema reason (`validation.*`). */
export function fieldErrorText(t: PayrollT, reason: string | undefined): string | undefined {
  if (!reason) return undefined;
  if (t(`serverErrors.${reason}` as never, { defaultValue: '' })) return t(`serverErrors.${reason}` as never);
  return t(`validation.${reason}` as never, { defaultValue: t('validation.required') });
}

/** Message for an error not tied to a form field: the first business reason, otherwise the generic API message. */
export function errorText(t: PayrollT, tCommon: TFunction<'common'>, error: unknown): string {
  if (isApiError(error) && error.code === 'VALIDATION' && error.fieldErrors) {
    const reason = Object.values(error.fieldErrors)[0]?.[0];
    if (reason) return fieldErrorText(t, reason) ?? tCommon('apiErrors.VALIDATION');
  }
  if (isApiError(error) && error.code === 'CONFLICT') return t('serverErrors.stateChanged');
  return isApiError(error) ? tCommon(`apiErrors.${error.code}`) : tCommon('apiErrors.SERVER');
}
