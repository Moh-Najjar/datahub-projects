import Alert from '@mui/material/Alert';
import Typography from '@mui/material/Typography';
import { useTranslation } from 'react-i18next';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { ModuleTabs } from '@/modules/shared/ModuleTabs';
import { PageHeader } from '@/modules/shared/PageHeader';
import { useOrganizationAccess } from '@/modules/organization/hooks/useOrganizationAccess';
import { orgPaths } from '@/modules/organization/paths';
import { DepartmentDetails } from '@/modules/organization/components/departments/DepartmentDetails';
import { DepartmentsSection } from '@/modules/organization/components/departments/DepartmentsSection';
import { HierarchySection } from '@/modules/organization/components/hierarchy/HierarchySection';
import { LocationDetails } from '@/modules/organization/components/locations/LocationDetails';
import { LocationsSection } from '@/modules/organization/components/locations/LocationsSection';
import { OverviewSection } from '@/modules/organization/components/OverviewSection';
import { PositionsSection } from '@/modules/organization/components/positions/PositionsSection';

const TABS = [
  { key: 'overview', to: orgPaths.overview },
  { key: 'departments', to: orgPaths.departments },
  { key: 'positions', to: orgPaths.positions },
  { key: 'locations', to: orgPaths.locations },
  { key: 'hierarchy', to: orgPaths.hierarchy },
] as const;

/** The tab for the current URL (detail pages belong to their list's tab). */
function currentTab(pathname: string): (typeof TABS)[number]['key'] {
  const section = pathname.slice(orgPaths.overview.length).split('/')[1];
  return TABS.find((tab) => tab.key === section)?.key ?? 'overview';
}

/**
 * Organization Management (`/organization/*`): one lazy-loaded page whose tabs are URLs, so each section
 * and every department/location detail can be linked and bookmarked. The router guards the whole page with
 * `organization:read`; write actions additionally require `organization:write` (UI only — see the API).
 */
export default function OrganizationPage() {
  const { t } = useTranslation('organization');
  const { canManage } = useOrganizationAccess();
  const { pathname } = useLocation();
  const tab = currentTab(pathname);

  return (
    <>
      <PageHeader
        title={t('title')}
        subtitle={
          <>
            {t('subtitle')}{' '}
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
      <ModuleTabs label={t('tabs.label')} value={tab} tabs={TABS.map((item) => ({ key: item.key, to: item.to, label: t(`tabs.${item.key}`) }))} />
      <Routes>
        <Route index element={<OverviewSection />} />
        <Route path="departments" element={<DepartmentsSection />} />
        <Route path="departments/:departmentId" element={<DepartmentDetails />} />
        <Route path="positions" element={<PositionsSection />} />
        <Route path="locations" element={<LocationsSection />} />
        <Route path="locations/:locationId" element={<LocationDetails />} />
        <Route path="hierarchy" element={<HierarchySection />} />
        <Route path="*" element={<Navigate to={orgPaths.overview} replace />} />
      </Routes>
    </>
  );
}
