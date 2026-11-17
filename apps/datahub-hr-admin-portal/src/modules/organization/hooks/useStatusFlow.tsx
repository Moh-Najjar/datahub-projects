import { useTranslation } from 'react-i18next';
import { useStatusFlow as useSharedStatusFlow, type StatusFlowOptions } from '@/modules/shared/hooks/useStatusFlow';
import { errorText } from '@/modules/organization/utils/serverErrors';

type Target = { id: string; status: 'active' | 'inactive' };
type Options<T extends Target> = Pick<StatusFlowOptions<T>, 'mutation' | 'name' | 'confirmTitle' | 'confirmText' | 'notify'>;

/** The shared activate/deactivate flow with Organization Management's wording and error reasons. */
export function useStatusFlow<T extends Target>(options: Options<T>) {
  const { t } = useTranslation('organization');
  const { t: tCommon } = useTranslation();
  return useSharedStatusFlow<T>({
    ...options,
    confirmLabel: t('actions.deactivate'),
    successText: (name, status) => t(status === 'active' ? 'feedback.activated' : 'feedback.deactivated', { name }),
    errorText: (error) => errorText(t, tCommon, error),
  });
}
