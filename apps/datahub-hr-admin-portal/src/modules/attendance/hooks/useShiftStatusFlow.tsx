import { useTranslation } from 'react-i18next';
import { useLanguage } from '@/i18n/useLanguage';
import { useStatusFlow, type StatusFlowOptions } from '@/modules/shared/hooks/useStatusFlow';
import { useUpdateShiftStatus } from '@/modules/attendance/hooks/useAttendance';
import type { Shift } from '@/modules/attendance/types/attendance';
import { errorText } from '@/modules/attendance/utils/serverErrors';

/** Activate / deactivate a shift (deactivation confirmed; "employees still assigned" shown in the dialog). */
export function useShiftStatusFlow(notify: StatusFlowOptions<Shift>['notify']) {
  const { t } = useTranslation('attendance');
  const { t: tCommon } = useTranslation();
  const { language } = useLanguage();
  return useStatusFlow<Shift>({
    mutation: useUpdateShiftStatus(),
    name: (s) => s.name[language],
    confirmTitle: (name) => t('shifts.confirmDeactivateTitle', { name }),
    confirmText: t('shifts.confirmDeactivateText'),
    confirmLabel: t('actions.deactivate'),
    successText: (name, status) => t(status === 'active' ? 'shifts.activated' : 'shifts.deactivated', { name }),
    errorText: (error) => errorText(t, tCommon, error),
    notify,
  });
}
