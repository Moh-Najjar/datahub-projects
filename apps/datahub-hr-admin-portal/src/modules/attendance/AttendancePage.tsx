import Alert from '@mui/material/Alert';
import Typography from '@mui/material/Typography';
import { useTranslation } from 'react-i18next';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { ModuleTabs } from '@/modules/shared/ModuleTabs';
import { PageHeader } from '@/modules/shared/PageHeader';
import { useAttendanceAccess } from '@/modules/attendance/hooks/useAttendanceAccess';
import { attendancePaths } from '@/modules/attendance/paths';
import { EmployeeHistory, HistoryPicker } from '@/modules/attendance/components/history/HistorySection';
import { OverviewSection } from '@/modules/attendance/components/OverviewSection';
import { RecordDetails } from '@/modules/attendance/components/records/RecordDetails';
import { RecordsSection } from '@/modules/attendance/components/records/RecordsSection';
import { ReportsSection } from '@/modules/attendance/components/reports/ReportsSection';
import { ShiftDetails } from '@/modules/attendance/components/shifts/ShiftDetails';
import { ShiftsSection } from '@/modules/attendance/components/shifts/ShiftsSection';

const TABS = [
  { key: 'overview', to: attendancePaths.overview },
  { key: 'records', to: attendancePaths.records },
  { key: 'shifts', to: attendancePaths.shifts },
  { key: 'history', to: attendancePaths.history },
  { key: 'reports', to: attendancePaths.reports },
] as const;

function currentTab(pathname: string): (typeof TABS)[number]['key'] {
  const section = pathname.slice(attendancePaths.overview.length).split('/')[1];
  return TABS.find((tab) => tab.key === section)?.key ?? 'overview';
}

/**
 * Attendance (`/attendance/*`): one lazy-loaded page. The router guards it with any attendance read permission.
 * Organization- and team-scoped roles get the overview, records, shifts, history and reports; roles with only
 * `hr.attendance.view.own` (self-service) get "My attendance". The API enforces the same scopes.
 */
export default function AttendancePage() {
  const { t } = useTranslation('attendance');
  const { scope, canManage, canReadBeyondOwn } = useAttendanceAccess();
  const { pathname } = useLocation();
  const tab = currentTab(pathname);
  const subtitle = scope.kind === 'own' ? t('ownSubtitle') : scope.kind === 'team' ? t('teamSubtitle') : t('subtitle');
  const backToOwn = <Navigate to={attendancePaths.overview} replace />;

  return (
    <>
      <PageHeader
        title={scope.kind === 'own' ? t('tabs.my') : t('title')}
        subtitle={
          <>
            {subtitle}{' '}
            <Typography component="span" variant="caption" color="text.secondary" sx={{ display: 'block' }}>
              {t('demoDataNote')}
            </Typography>
          </>
        }
      />
      {canReadBeyondOwn && !canManage && (
        <Alert severity="info" sx={{ mb: 2 }}>
          {t('readOnlyNote')}
        </Alert>
      )}
      {canReadBeyondOwn && (
        <ModuleTabs label={t('tabs.label')} value={tab} tabs={TABS.map((item) => ({ key: item.key, to: item.to, label: t(`tabs.${item.key}`) }))} />
      )}
      <Routes>
        <Route index element={canReadBeyondOwn ? <OverviewSection /> : <EmployeeHistory employeeId="me" />} />
        <Route path="records" element={canReadBeyondOwn ? <RecordsSection /> : backToOwn} />
        <Route path="records/:recordId" element={<RecordDetails />} />
        <Route path="shifts" element={canReadBeyondOwn ? <ShiftsSection /> : backToOwn} />
        <Route path="shifts/:shiftId" element={canReadBeyondOwn ? <ShiftDetails /> : backToOwn} />
        <Route path="history" element={canReadBeyondOwn ? <HistoryPicker /> : backToOwn} />
        <Route path="history/:employeeId" element={<EmployeeHistory />} />
        <Route path="reports" element={canReadBeyondOwn ? <ReportsSection /> : backToOwn} />
        <Route path="*" element={backToOwn} />
      </Routes>
    </>
  );
}
