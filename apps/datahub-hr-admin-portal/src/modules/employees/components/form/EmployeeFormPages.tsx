import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { useBreadcrumbs } from '@/core/context/breadcrumbContext';
import { useLanguage } from '@/i18n/useLanguage';
import { QueryBoundary } from '@/modules/shared/Panel';
import { useEmployeeAccess } from '@/modules/employees/hooks/useEmployeeAccess';
import { useEmployee } from '@/modules/employees/hooks/useEmployees';
import { employeePaths } from '@/modules/employees/paths';
import type { Employee } from '@/modules/employees/types/employee';
import { displayName } from '@/modules/employees/utils/names';
import { EmployeeForm } from './EmployeeForm';

/** Roles without `employees:write` never see the form (the backend must refuse their writes as well). */
function NoPermission() {
  const { t } = useTranslation('employees');
  return <Alert severity="warning">{t('noPermission')}</Alert>;
}

/** `/employees/new` */
export function CreateEmployeePage() {
  const { t } = useTranslation('employees');
  const { canManage } = useEmployeeAccess();
  useBreadcrumbs([{ label: t('form.createTitle') }]);
  if (!canManage) return <NoPermission />;
  return (
    <Stack spacing={2.5}>
      <Typography variant="h5" component="h2">
        {t('form.createTitle')}
      </Typography>
      <EmployeeForm />
    </Stack>
  );
}

/** `/employees/:employeeId/edit` */
export function EditEmployeePage() {
  const { t } = useTranslation('employees');
  const { employeeId = '' } = useParams();
  const { canManage } = useEmployeeAccess();
  const query = useEmployee(employeeId);
  if (!canManage) return <NoPermission />;
  return (
    <QueryBoundary query={query} notFoundText={t('profile.notFound')} forbiddenText={t('profile.forbidden')}>
      {query.data && <EditView employee={query.data} />}
    </QueryBoundary>
  );
}

function EditView({ employee }: { employee: Employee }) {
  const { t } = useTranslation('employees');
  const { language } = useLanguage();
  const name = displayName(employee.name, language);
  useBreadcrumbs([{ label: name, to: employeePaths.profile(employee.id) }, { label: t('actions.edit') }]);
  return (
    <Stack spacing={2.5}>
      <Typography variant="h5" component="h2">
        {t('form.editTitle')}: {name}
      </Typography>
      {/* Keyed by id so switching employees starts from fresh values. */}
      <EmployeeForm key={employee.id} employee={employee} />
    </Stack>
  );
}
