import Alert from '@mui/material/Alert';
import { useTranslation } from 'react-i18next';
import { useLeaveAccess } from '@/modules/leave/hooks/useLeaveAccess';
import { EmployeeLeave } from './balances/EmployeeLeave';

/**
 * "Leave" tab of the Employee Profile (Employee Management): balances, balance history and requests of that employee,
 * through the Leave API — so its scope rules apply (organization, own team, or own leave only). The profile shows the
 * tab only to roles with a leave read permission.
 */
export function EmployeeLeaveTab({ employeeId }: { employeeId: string }) {
  const { t } = useTranslation('leave');
  const { canReadBeyondOwn } = useLeaveAccess();
  if (!canReadBeyondOwn) return <Alert severity="info">{t('profile.ownOnly')}</Alert>;
  return <EmployeeLeave employeeId={employeeId} embedded />;
}
