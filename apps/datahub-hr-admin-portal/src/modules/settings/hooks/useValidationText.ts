import { useTranslation } from 'react-i18next';

/** A reason key from the schema or the API (`settings:validation.*`), translated. */
export function useValidationText() {
  const { t } = useTranslation('settings');
  return (reason: string | undefined) => (reason ? (t(`validation.${reason}` as never, { defaultValue: t('validation.invalid') }) as string) : undefined);
}
