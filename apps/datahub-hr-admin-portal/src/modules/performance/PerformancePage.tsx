import type { ReactNode } from 'react';
import Typography from '@mui/material/Typography';
import { useTranslation } from 'react-i18next';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { ModuleTabs } from '@/modules/shared/ModuleTabs';
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
  const beyondOwn = (element: ReactNode) => (canReadBeyondOwn ? element : back);

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
        <ModuleTabs
          label={t('tabs.label')}
          value={tabs.some((item) => item.key === tab) ? tab : false}
          tabs={tabs.map((item) => ({ key: item.key, to: item.to, label: t(`tabs.${item.key}`) }))}
        />
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
