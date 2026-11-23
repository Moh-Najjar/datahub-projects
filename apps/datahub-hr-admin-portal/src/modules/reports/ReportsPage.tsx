import type { ReactNode } from 'react';
import Alert from '@mui/material/Alert';
import { useTranslation } from 'react-i18next';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { ModuleTabs } from '@/modules/shared/ModuleTabs';
import { PageHeader } from '@/modules/shared/PageHeader';
import { BuilderSection } from '@/modules/reports/components/BuilderSection';
import { CategorySection } from '@/modules/reports/components/CategorySection';
import { ExecutiveSection, InsightsSection, OverviewSection } from '@/modules/reports/components/OverviewSections';
import { SavedSection } from '@/modules/reports/components/SavedSection';
import { useReportsAccess } from '@/modules/reports/hooks/useReportsAccess';
import { reportPaths } from '@/modules/reports/paths';
import { REPORT_CATEGORIES, REPORT_TABS, type ReportTab } from '@/modules/reports/types/reports';

function currentTab(pathname: string): ReportTab {
  const section = pathname.slice(reportPaths.overview.length).split('/')[1] ?? '';
  return REPORT_TABS.find((k) => k === section) ?? 'overview';
}

/**
 * Reports & Analytics (`/reports/*`): one lazy-loaded page. Each tab appears only when the role may use it (see
 * utils/access.ts); the reports API checks the same rules on every call. Roles without the overview (Payroll Officer,
 * Recruiter) land on their own category.
 */
export default function ReportsPage() {
  const { t } = useTranslation('reports');
  const { access } = useReportsAccess();
  const { pathname } = useLocation();
  const tab = currentTab(pathname);
  const visible = REPORT_TABS.filter((k) => access.tabs.has(k));
  const home = visible[0] ?? 'overview';
  const homePath = home === 'overview' ? reportPaths.overview : reportPaths.tab(home);
  const back = <Navigate to={homePath} replace />;
  const when = (key: ReportTab, element: ReactNode) => (access.tabs.has(key) ? element : back);

  return (
    <>
      <PageHeader title={t('title')} subtitle={access.team ? t('teamSubtitle') : t('subtitle')} />
      <Alert severity="info" sx={{ mb: 2.5 }}>
        {t('demoNotice')}
      </Alert>
      <ModuleTabs
        label={t('tabs.label')}
        value={visible.includes(tab) ? tab : false}
        tabs={visible.map((key) => ({ key, to: key === 'overview' ? reportPaths.overview : reportPaths.tab(key), label: t(`tabs.${key}`) }))}
      />
      <Routes>
        <Route index element={access.tabs.has('overview') ? <OverviewSection /> : home !== 'overview' ? back : null} />
        {REPORT_CATEGORIES.map((category) => (
          <Route key={category} path={category} element={when(category, <CategorySection key={category} category={category} />)} />
        ))}
        <Route path="insights" element={when('insights', <InsightsSection />)} />
        <Route path="executive" element={when('executive', <ExecutiveSection />)} />
        <Route path="builder" element={when('builder', <BuilderSection />)} />
        <Route path="saved" element={when('saved', <SavedSection />)} />
        <Route path="*" element={back} />
      </Routes>
    </>
  );
}
