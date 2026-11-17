import type { TFunction } from 'i18next';
import { isApiError } from '@/core/api/types';
import { serverReason } from '@/modules/shared/utils/serverErrors';

type EmpT = TFunction<'employees'>;

/** Translates a field error: a schema reason (`validation.*`) or a backend reason (`serverErrors.*`). */
export function fieldErrorText(t: EmpT, reason: string | undefined): string | undefined {
  if (!reason) return undefined;
  if (t(`serverErrors.${reason}` as never, { defaultValue: '' })) return t(`serverErrors.${reason}` as never);
  return t(`validation.${reason}` as never, { defaultValue: t('validation.required') });
}

/** Message for an error not tied to a field: a known business reason, otherwise the generic API message. */
export function errorText(t: EmpT, tCommon: TFunction<'common'>, error: unknown): string {
  const reason = serverReason(error);
  if (reason) return t(`serverErrors.${reason}` as never, { defaultValue: t('form.saveError') });
  return isApiError(error) ? tCommon(`apiErrors.${error.code}`) : t('form.saveError');
}
