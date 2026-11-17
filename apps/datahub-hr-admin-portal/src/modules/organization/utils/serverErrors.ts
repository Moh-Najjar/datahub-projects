import type { TFunction } from 'i18next';
import { isApiError } from '@/core/api/types';
import { serverReason } from '@/modules/shared/utils/serverErrors';

export { applyServerErrors } from '@/modules/shared/utils/serverErrors';

type OrgT = TFunction<'organization'>;

/** Translates a field error message: a schema reason (`validation.*`) or a backend reason (`serverErrors.*`). */
export function fieldErrorText(t: OrgT, message: string | undefined): string | undefined {
  if (!message) return undefined;
  const key = `serverErrors.${message}`;
  if (t(key as never, { defaultValue: '' })) return t(key as never);
  return t(`validation.${message}` as never, { defaultValue: t('validation.required') });
}

/** Message for an error that is not a field error: a known business reason, otherwise the generic API message. */
export function errorText(t: OrgT, tCommon: TFunction<'common'>, error: unknown): string {
  const reason = serverReason(error);
  if (reason) return t(`serverErrors.${reason}` as never, { defaultValue: t('forms.saveError') });
  return isApiError(error) ? tCommon(`apiErrors.${error.code}`) : t('forms.saveError');
}
