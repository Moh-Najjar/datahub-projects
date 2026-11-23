import { lazy, Suspense } from 'react';
import Alert from '@mui/material/Alert';
import LinearProgress from '@mui/material/LinearProgress';
import Typography from '@mui/material/Typography';
import { useTranslation } from 'react-i18next';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { ModuleTabs } from '@/modules/shared/ModuleTabs';
import { PageHeader } from '@/modules/shared/PageHeader';
import { useRecruitmentAccess } from '@/modules/recruitment/hooks/useRecruitmentAccess';
import { recruitmentPaths } from '@/modules/recruitment/paths';
import { CandidateProfile } from '@/modules/recruitment/components/candidates/CandidateProfile';
import { CandidatesSection } from '@/modules/recruitment/components/candidates/CandidatesSection';
import { InterviewDetails } from '@/modules/recruitment/components/interviews/InterviewDetails';
import { InterviewsSection } from '@/modules/recruitment/components/interviews/InterviewsSection';
import { OfferDetails } from '@/modules/recruitment/components/offers/OfferDetails';
import { OffersSection } from '@/modules/recruitment/components/offers/OffersSection';
import { OverviewSection } from '@/modules/recruitment/components/OverviewSection';
import { PipelineSection } from '@/modules/recruitment/components/pipeline/PipelineSection';
import { RequisitionDetails } from '@/modules/recruitment/components/requisitions/RequisitionDetails';
import { RequisitionsSection } from '@/modules/recruitment/components/requisitions/RequisitionsSection';

/** Loaded on demand: it renders Employee Management's form, which only HR needs and only when converting a hire. */
const ConvertPage = lazy(() => import('@/modules/recruitment/components/candidates/ConvertPage').then((m) => ({ default: m.ConvertPage })));

type TabKey = 'overview' | 'requisitions' | 'candidates' | 'pipeline' | 'interviews' | 'offers';

function currentTab(pathname: string): TabKey {
  const section = pathname.slice(recruitmentPaths.overview.length).split('/')[1] ?? '';
  return (['requisitions', 'candidates', 'pipeline', 'interviews', 'offers'] as const).find((k) => k === section) ?? 'overview';
}

/**
 * Recruitment (`/recruitment/*`): one lazy-loaded page, guarded by `recruitment.jobs.view` or `hr.recruitment.view.team`.
 * Team scope (Department Manager) is read-only and has no Offers section. The API enforces the same scopes.
 */
export default function RecruitmentPage() {
  const { t } = useTranslation('recruitment');
  const { scope, canManage, canSeeOffers } = useRecruitmentAccess();
  const { pathname } = useLocation();
  const tab = currentTab(pathname);
  const tabs: Array<{ key: TabKey; to: string }> = [
    { key: 'overview', to: recruitmentPaths.overview },
    { key: 'requisitions', to: recruitmentPaths.requisitions },
    { key: 'candidates', to: recruitmentPaths.candidates },
    { key: 'pipeline', to: recruitmentPaths.pipeline },
    { key: 'interviews', to: recruitmentPaths.interviews },
    ...(canSeeOffers ? [{ key: 'offers' as const, to: recruitmentPaths.offers }] : []),
  ];
  const back = <Navigate to={recruitmentPaths.overview} replace />;

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
      <ModuleTabs
        label={t('tabs.label')}
        value={tabs.some((item) => item.key === tab) ? tab : false}
        tabs={tabs.map((item) => ({ key: item.key, to: item.to, label: t(`tabs.${item.key}`) }))}
      />
      <Routes>
        <Route index element={<OverviewSection />} />
        <Route path="requisitions" element={<RequisitionsSection />} />
        <Route path="requisitions/:requisitionId" element={<RequisitionDetails />} />
        <Route path="candidates" element={<CandidatesSection />} />
        <Route path="candidates/:candidateId" element={<CandidateProfile />} />
        <Route
          path="candidates/:candidateId/convert"
          element={
            <Suspense fallback={<LinearProgress aria-label={t('conversion.title')} />}>
              <ConvertPage />
            </Suspense>
          }
        />
        <Route path="pipeline" element={<PipelineSection />} />
        <Route path="interviews" element={<InterviewsSection />} />
        <Route path="interviews/:interviewId" element={<InterviewDetails />} />
        <Route path="offers" element={canSeeOffers ? <OffersSection /> : back} />
        <Route path="offers/:offerId" element={canSeeOffers ? <OfferDetails /> : back} />
        <Route path="*" element={back} />
      </Routes>
    </>
  );
}
