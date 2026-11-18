import type { ReactNode } from 'react';
import Typography from '@mui/material/Typography';
import { useTranslation } from 'react-i18next';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { ModuleTabs } from '@/modules/shared/ModuleTabs';
import { PageHeader } from '@/modules/shared/PageHeader';
import { useLeaveAccess } from '@/modules/leave/hooks/useLeaveAccess';
import { leavePaths } from '@/modules/leave/paths';
import { BalancesSection } from '@/modules/leave/components/balances/BalancesSection';
import { EmployeeBalancesPage, EmployeeLeave } from '@/modules/leave/components/balances/EmployeeLeave';
import { CalendarSection } from '@/modules/leave/components/calendar/CalendarSection';
import { OverviewSection } from '@/modules/leave/components/OverviewSection';
import { ReportsSection } from '@/modules/leave/components/reports/ReportsSection';
import { RequestDetails } from '@/modules/leave/components/requests/RequestDetails';
import { RequestsSection } from '@/modules/leave/components/requests/RequestsSection';
import { TypeDetails } from '@/modules/leave/components/types/TypeDetails';
import { TypesSection } from '@/modules/leave/components/types/TypesSection';

type TabKey = 'overview' | 'requests' | 'approvals' | 'my' | 'balances' | 'calendar' | 'reports' | 'types';

function currentTab(pathname: string): TabKey {
  const section = pathname.slice(leavePaths.overview.length).split('/')[1] ?? '';
  return (['requests', 'approvals', 'my', 'balances', 'calendar', 'reports', 'types'] as const).find((k) => k === section) ?? 'overview';
}

/**
 * Leave (`/leave/*`): one lazy-loaded page. The router guards it with any leave read permission. Organization- and
 * team-scoped roles get the overview, requests, approvals, their own leave, balances, calendar, reports and types;
 * roles with only `leave:read:own` (self-service) get "My leave". The API enforces the same scopes.
 */
export default function LeavePage() {
  const { t } = useTranslation('leave');
  const { scope, canReadBeyondOwn, canApprove } = useLeaveAccess();
  const { pathname } = useLocation();
  const tab = currentTab(pathname);
  const tabs: Array<{ key: TabKey; to: string }> = [
    { key: 'overview', to: leavePaths.overview },
    { key: 'requests', to: leavePaths.requests },
    ...(canApprove ? [{ key: 'approvals' as const, to: leavePaths.approvals }] : []),
    { key: 'my', to: leavePaths.my },
    { key: 'balances', to: leavePaths.balances },
    { key: 'calendar', to: leavePaths.calendar },
    { key: 'reports', to: leavePaths.reports },
    { key: 'types', to: leavePaths.types },
  ];
  const subtitle = scope.kind === 'own' ? t('ownSubtitle') : scope.kind === 'team' ? t('teamSubtitle') : t('subtitle');
  const backToStart = <Navigate to={leavePaths.overview} replace />;
  const beyondOwn = (element: ReactNode) => (canReadBeyondOwn ? element : backToStart);

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
      {canReadBeyondOwn && (
        <ModuleTabs
          label={t('tabs.label')}
          value={tabs.some((item) => item.key === tab) ? tab : false}
          tabs={tabs.map((item) => ({ key: item.key, to: item.to, label: t(`tabs.${item.key}`) }))}
        />
      )}
      <Routes>
        <Route index element={canReadBeyondOwn ? <OverviewSection /> : <EmployeeLeave employeeId="me" embedded />} />
        <Route path="requests" element={beyondOwn(<RequestsSection />)} />
        <Route path="requests/:requestId" element={<RequestDetails />} />
        <Route path="approvals" element={canApprove && canReadBeyondOwn ? <RequestsSection awaiting /> : backToStart} />
        <Route path="my" element={beyondOwn(<EmployeeLeave employeeId="me" />)} />
        <Route path="balances" element={beyondOwn(<BalancesSection />)} />
        <Route path="balances/:employeeId" element={beyondOwn(<EmployeeBalancesPage />)} />
        <Route path="calendar" element={beyondOwn(<CalendarSection />)} />
        <Route path="reports" element={beyondOwn(<ReportsSection />)} />
        <Route path="types" element={beyondOwn(<TypesSection />)} />
        <Route path="types/:typeId" element={beyondOwn(<TypeDetails />)} />
        <Route path="*" element={backToStart} />
      </Routes>
    </>
  );
}
