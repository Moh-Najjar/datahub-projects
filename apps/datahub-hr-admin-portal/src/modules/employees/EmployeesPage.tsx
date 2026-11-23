import Alert from '@mui/material/Alert';
import Typography from '@mui/material/Typography';
import { useTranslation } from 'react-i18next';
import { Navigate, Route, Routes } from 'react-router-dom';
import { PageHeader } from '@/modules/shared/PageHeader';
import { useEmployeeAccess } from '@/modules/employees/hooks/useEmployeeAccess';
import { employeePaths } from '@/modules/employees/paths';
import { EmployeeDirectory } from '@/modules/employees/components/EmployeeDirectory';
import { EmployeeProfile } from '@/modules/employees/components/EmployeeProfile';
import { CreateEmployeePage, EditEmployeePage } from '@/modules/employees/components/form/EmployeeFormPages';

/**
 * Employee Management (`/employees/*`): one lazy-loaded page. The router guards it with `organization.employees.view` or
 * `hr.employees.view.team`; the directory/profile then use the role's scope (organization or own team) and only roles
 * with `organization.employees.manage` get create / edit / status actions. UI only — the backend must enforce all of it.
 */
export default function EmployeesPage() {
  const { t } = useTranslation('employees');
  const { scope, canManage } = useEmployeeAccess();

  return (
    <>
      <PageHeader
        title={t('title')}
        subtitle={
          <>
            {scope.kind === 'team' ? t('teamSubtitle') : t('subtitle')}{' '}
            <Typography component="span" variant="caption" color="text.secondary" sx={{ display: 'block' }}>
              {t('demoDataNote')}
            </Typography>
          </>
        }
      />
      {!canManage && (
        <Alert severity="info" sx={{ mb: 2 }}>
          {t('readOnlyNote')}
        </Alert>
      )}
      <Routes>
        <Route index element={<EmployeeDirectory />} />
        <Route path="new" element={<CreateEmployeePage />} />
        <Route path=":employeeId" element={<EmployeeProfile />} />
        <Route path=":employeeId/edit" element={<EditEmployeePage />} />
        <Route path="*" element={<Navigate to={employeePaths.directory} replace />} />
      </Routes>
    </>
  );
}
