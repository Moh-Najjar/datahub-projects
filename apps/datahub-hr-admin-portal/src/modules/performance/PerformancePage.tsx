import Box from '@mui/material/Box';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Typography from '@mui/material/Typography';
import { useTranslation } from 'react-i18next';
import { Link, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { PageHeader } from '@/modules/shared/PageHeader';
import { usePerformanceAccess } from '@/modules/performance/hooks/usePerformanceAccess';
import { performancePaths } from '@/modules/performance/paths';
import { CompetenciesSection } from '@/modules/performance/components/competencies/CompetenciesSection';
import { CycleDetails } from '@/modules/performance/components/cycles/CycleDetails';
import { CyclesSection } from '@/modules/performance/components/cycles/CyclesSection';
import { PlanDetails } from '@/modules/performance/components/development/PlanDetails';
import { PlansSection } from '@/modules/performance/components/development/PlansSection';
import { EmployeePerformance } from '@/modules/performance/components/EmployeePerformance';
import { GoalsSection } from '@/modules/performance/components/goals/GoalsSection';
import { OverviewSection } from '@/modules/performance/components/OverviewSection';
import { ReviewPage } from '@/modules/performance/components/reviews/ReviewPage';
import { ReviewsSection } from '@/modules/performance/components/reviews/ReviewsSection';

type TabKey = 'overview' | 'my' | 'reviews' | 'goals' | 'cycles' | 'development' | 'competencies';

function currentTab(pathname: string): TabKey {
  const section = pathname.slice(performancePaths.overview.length).split('/')[1] ?? '';
  return (['my', 'reviews', 'goals', 'cycles', 'development', 'competencies'] as const).find((k) => k === section) ?? 'overview';
}

/**
 * Performance (`/performance/*`): one lazy-loaded page, guarded by any performance read permission. HR roles get the
 * organization; Department Managers their team; everyone else "My performance" (own reviews, goals, plans).
 */
export default function PerformancePage() {
  const { t } = useTranslation('performance');
  const { scope, canReadBeyondOwn } = usePerformanceAccess();
  const { pathname } = useLocation();
  const tab = currentTab(pathname);
  const tabs: Array<{ key: TabKey; to: string }> = [
    { key: 'overview', to: performancePaths.overview },
    { key: 'my', to: performancePaths.my },
    { key: 'reviews', to: performancePaths.reviews },
    { key: 'goals', to: performancePaths.goals },
    { key: 'cycles', to: performancePaths.cycles },
    { key: 'development', to: performancePaths.development },
    { key: 'competencies', to: performancePaths.competencies },
  ];
  const back = <Navigate to={performancePaths.overview} replace />;
  const beyondOwn = (element: React.ReactNode) => (canReadBeyondOwn ? element : back);

  return (
    <>
      <PageHeader
        title={scope.kind === 'own' ? t('tabs.my') : t('title')}
        subtitle={
          <>
            {scope.kind === 'own' ? t('ownSubtitle') : scope.kind === 'team' ? t('teamSubtitle') : t('subtitle')}{' '}
            <Typography component="span" variant="caption" color="text.secondary" sx={{ display: 'block' }}>
              {t('demoDataNote')}
            </Typography>
          </>
        }
      />
      {canReadBeyondOwn && (
        <Box component="nav" aria-label={t('tabs.label')} sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
          {/* No scroll arrows: MUI's automatic detection misfires in RTL; the tabs still scroll by swipe/keyboard. */}
          <Tabs value={tabs.some((x) => x.key === tab) ? tab : false} variant="scrollable" scrollButtons={false}>
            {tabs.map((item) => (
              <Tab key={item.key} value={item.key} label={t(`tabs.${item.key}`)} component={Link} to={item.to} aria-current={item.key === tab ? 'page' : undefined} />
            ))}
          </Tabs>
        </Box>
      )}
      <Routes>
        <Route index element={canReadBeyondOwn ? <OverviewSection /> : <EmployeePerformance employeeId="me" embedded />} />
        <Route path="my" element={beyondOwn(<EmployeePerformance employeeId="me" />)} />
        <Route path="reviews" element={beyondOwn(<ReviewsSection />)} />
        <Route path="reviews/:reviewId" element={<ReviewPage />} />
        <Route path="goals" element={beyondOwn(<GoalsSection />)} />
        <Route path="cycles" element={beyondOwn(<CyclesSection />)} />
        <Route path="cycles/:cycleId" element={beyondOwn(<CycleDetails />)} />
        <Route path="development" element={beyondOwn(<PlansSection />)} />
        <Route path="development/:planId" element={<PlanDetails />} />
        <Route path="competencies" element={beyondOwn(<CompetenciesSection />)} />
        <Route path="*" element={back} />
      </Routes>
    </>
  );
}
