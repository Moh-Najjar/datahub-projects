import { useTranslation } from 'react-i18next';
import { useLanguage } from '@/i18n/useLanguage';
import { useStatusFlow, type StatusFlowOptions } from '@/modules/shared/hooks/useStatusFlow';
import { useUpdateEmployeeStatus } from '@/modules/employees/hooks/useEmployees';
import type { EmployeeSummary } from '@/modules/employees/types/employee';
import { displayName } from '@/modules/employees/utils/names';
import { errorText } from '@/modules/employees/utils/serverErrors';

/** Activate / deactivate an employee (deactivation confirmed; refusals such as "manages a department" shown). */
export function useEmployeeStatusFlow(notify: StatusFlowOptions<EmployeeSummary>['notify']) {
  const { t } = useTranslation('employees');
  const { t: tCommon } = useTranslation();
  const { language } = useLanguage();
  return useStatusFlow<EmployeeSummary>({
    mutation: useUpdateEmployeeStatus(),
    name: (e) => displayName(e.name, language),
    confirmTitle: (name) => t('confirm.deactivateTitle', { name }),
    confirmText: t('confirm.deactivateText'),
    confirmLabel: t('actions.deactivate'),
    successText: (name, status) => t(status === 'active' ? 'feedback.activated' : 'feedback.deactivated', { name }),
    errorText: (error) => errorText(t, tCommon, error),
    notify,
  });
}
