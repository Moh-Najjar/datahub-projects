import { useTranslation } from 'react-i18next';
import { useLanguage } from '@/i18n/useLanguage';
import { useStatusFlow } from '@/modules/shared/hooks/useStatusFlow';
import { useUpdateLeaveTypeStatus } from '@/modules/leave/hooks/useLeave';
import type { LeaveType } from '@/modules/leave/types/leave';
import { errorText } from '@/modules/leave/utils/serverErrors';

/** Activate / deactivate a leave type (deactivation confirmed). */
export function useTypeStatusFlow(notify: (text: string, severity?: 'success' | 'error') => void) {
  const { t } = useTranslation('leave');
  const { t: tCommon } = useTranslation();
  const { language } = useLanguage();
  return useStatusFlow<LeaveType>({
    mutation: useUpdateLeaveTypeStatus(),
    name: (x) => x.name[language],
    confirmTitle: (name) => t('types.confirmDeactivateTitle', { name }),
    confirmText: t('types.confirmDeactivateText'),
    confirmLabel: t('actions.deactivate'),
    successText: (name, status) => t(status === 'active' ? 'types.activated' : 'types.deactivated', { name }),
    errorText: (error) => errorText(t, tCommon, error),
    notify,
  });
}
