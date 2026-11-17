import { useTranslation } from 'react-i18next';
import { useLanguage } from '@/i18n/useLanguage';
import { useStatusFlow } from '@/modules/shared/hooks/useStatusFlow';
import { useUpdateCompetencyStatus } from '@/modules/performance/hooks/usePerformance';
import type { Competency } from '@/modules/performance/types/performance';
import { errorText } from '@/modules/performance/utils/serverErrors';

/** Activate / deactivate a competency (deactivation confirmed; refused while used by an open cycle's template). */
export function useCompetencyStatusFlow(notify: (text: string, severity?: 'success' | 'error') => void) {
  const { t } = useTranslation('performance');
  const { t: tCommon } = useTranslation();
  const { language } = useLanguage();
  return useStatusFlow<Competency>({
    mutation: useUpdateCompetencyStatus(),
    name: (c) => c.name[language],
    confirmTitle: (name) => t('competencies.confirmDeactivateTitle', { name }),
    confirmText: t('competencies.confirmDeactivateText'),
    confirmLabel: t('actions.deactivate'),
    successText: (name, status) => t(status === 'active' ? 'competencies.activated' : 'competencies.deactivated', { name }),
    errorText: (error) => errorText(t, tCommon, error),
    notify,
  });
}
