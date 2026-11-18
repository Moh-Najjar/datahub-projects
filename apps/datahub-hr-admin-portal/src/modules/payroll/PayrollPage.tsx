import type { ReactNode } from 'react';
import Alert from '@mui/material/Alert';
import { useTranslation } from 'react-i18next';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { ModuleTabs } from '@/modules/shared/ModuleTabs';
import { PageHeader } from '@/modules/shared/PageHeader';
import { usePayrollAccess } from '@/modules/payroll/hooks/usePayrollAccess';
import { payrollPaths } from '@/modules/payroll/paths';
import { CompensationDetails } from '@/modules/payroll/components/compensation/CompensationDetails';
import { CompensationSection } from '@/modules/payroll/components/compensation/CompensationSection';
import { AllowancesSection, DeductionsSection, StructuresSection } from '@/modules/payroll/components/config/ConfigSections';
import { MyPayroll } from '@/modules/payroll/components/MyPayroll';
import { OverviewSection } from '@/modules/payroll/components/OverviewSection';
import { PayslipPage } from '@/modules/payroll/components/payslips/PayslipPage';
import { PayslipsSection } from '@/modules/payroll/components/payslips/PayslipsSection';
import { ReportsSection } from '@/modules/payroll/components/reports/ReportsSection';
import { LineDetails } from '@/modules/payroll/components/runs/LineDetails';
import { RunDetails } from '@/modules/payroll/components/runs/RunDetails';
import { RunsSection } from '@/modules/payroll/components/runs/RunsSection';

const SECTIONS = ['runs', 'compensation', 'structures', 'allowances', 'deductions', 'payslips', 'reports', 'my'] as const;
type TabKey = 'overview' | (typeof SECTIONS)[number];

function currentTab(pathname: string): TabKey {
  const section = pathname.slice(payrollPaths.overview.length).split('/')[1] ?? '';
  return SECTIONS.find((k) => k === section) ?? 'overview';
}

/**
 * Payroll (`/payroll/*`): one lazy-loaded page. Payroll roles (payroll:read) get the organization's payroll; every
 * other staff member gets "My payroll" (own compensation and payslips only — payroll:read:own).
 */
export default function PayrollPage() {
  const { t } = useTranslation('payroll');
  const { canReadOrganization } = usePayrollAccess();
  const { pathname } = useLocation();
  const tab = currentTab(pathname);
  const tabs: Array<{ key: TabKey; to: string }> = [
    { key: 'overview', to: payrollPaths.overview },
    { key: 'runs', to: payrollPaths.runs },
    { key: 'compensation', to: payrollPaths.compensation },
    { key: 'structures', to: payrollPaths.structures },
    { key: 'allowances', to: payrollPaths.allowances },
    { key: 'deductions', to: payrollPaths.deductions },
    { key: 'payslips', to: payrollPaths.payslips },
    { key: 'reports', to: payrollPaths.reports },
    { key: 'my', to: payrollPaths.my },
  ];
  const back = <Navigate to={payrollPaths.overview} replace />;
  const org = (element: ReactNode) => (canReadOrganization ? element : back);

  return (
    <>
      <PageHeader title={canReadOrganization ? t('title') : t('tabs.my')} subtitle={canReadOrganization ? t('subtitle') : t('ownSubtitle')} />
      <Alert severity="info" sx={{ mb: 2.5 }}>
        {t('demoNotice')}
      </Alert>
      {canReadOrganization && (
        <ModuleTabs label={t('tabs.label')} value={tab} tabs={tabs.map((item) => ({ key: item.key, to: item.to, label: t(`tabs.${item.key}`) }))} />
      )}
      <Routes>
        <Route index element={canReadOrganization ? <OverviewSection /> : <MyPayroll />} />
        <Route path="my" element={org(<MyPayroll />)} />
        <Route path="runs" element={org(<RunsSection />)} />
        <Route path="runs/:runId" element={org(<RunDetails />)} />
        <Route path="runs/:runId/employees/:employeeId" element={org(<LineDetails />)} />
        <Route path="compensation" element={org(<CompensationSection />)} />
        <Route path="compensation/:employeeId" element={org(<CompensationDetails />)} />
        <Route path="structures" element={org(<StructuresSection />)} />
        <Route path="allowances" element={org(<AllowancesSection />)} />
        <Route path="deductions" element={org(<DeductionsSection />)} />
        <Route path="payslips" element={org(<PayslipsSection />)} />
        {/* Every role: the API returns only the caller's own payslip in own scope (others are "not found"). */}
        <Route path="payslips/:payslipId" element={<PayslipPage />} />
        <Route path="reports" element={org(<ReportsSection />)} />
        <Route path="*" element={back} />
      </Routes>
    </>
  );
}
