import { useTranslation } from 'react-i18next';
import { useLanguage } from '@/i18n/useLanguage';
import { useStatusFlow } from '@/modules/shared/hooks/useStatusFlow';
import { useUpdateAllowanceTypeStatus, useUpdateDeductionTypeStatus, useUpdateStructureStatus } from '@/modules/payroll/hooks/usePayroll';
import type { AllowanceType, DeductionType, SalaryStructure } from '@/modules/payroll/types/payroll';
import { errorText } from '@/modules/payroll/utils/serverErrors';

type Notify = (text: string, severity?: 'success' | 'error') => void;

/** Activate / deactivate a salary structure, allowance type or deduction type (deactivation is confirmed). */
function useFlow<T extends SalaryStructure | AllowanceType | DeductionType>(kind: 'structures' | 'allowances' | 'deductions', mutation: Parameters<typeof useStatusFlow<T>>[0]['mutation'], notify: Notify) {
  const { t } = useTranslation('payroll');
  const { t: tCommon } = useTranslation();
  const { language } = useLanguage();
  return useStatusFlow<T>({
    mutation,
    name: (x) => x.name[language],
    confirmTitle: (name) => t(`${kind}.deactivateTitle`, { name }),
    confirmText: t(`${kind}.deactivateText`),
    confirmLabel: t('actions.deactivate'),
    successText: (name, status) => t(status === 'active' ? 'common.activated' : 'common.deactivated', { name }),
    errorText: (error) => errorText(t, tCommon, error),
    notify,
  });
}

export const useStructureStatusFlow = (notify: Notify) => useFlow<SalaryStructure>('structures', useUpdateStructureStatus(), notify);
export const useAllowanceStatusFlow = (notify: Notify) => useFlow<AllowanceType>('allowances', useUpdateAllowanceTypeStatus(), notify);
export const useDeductionStatusFlow = (notify: Notify) => useFlow<DeductionType>('deductions', useUpdateDeductionTypeStatus(), notify);
