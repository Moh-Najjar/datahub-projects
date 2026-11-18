import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { ModuleTabs } from '@/modules/shared/ModuleTabs';
import { PageHeader } from '@/modules/shared/PageHeader';
import { useDocumentsAccess } from '@/modules/documents/hooks/useDocumentsAccess';
import { documentPaths } from '@/modules/documents/paths';
import { RequiredSection } from '@/modules/documents/components/compliance/RequiredSection';
import { CategoriesSection } from '@/modules/documents/components/config/CategoriesSection';
import { DocumentDetails } from '@/modules/documents/components/details/DocumentDetails';
import { DirectorySection } from '@/modules/documents/components/DirectorySection';
import { ExpirySection } from '@/modules/documents/components/ExpirySection';
import { MyDocuments } from '@/modules/documents/components/MyDocuments';
import { OverviewSection } from '@/modules/documents/components/OverviewSection';

const SECTIONS = ['directory', 'expiry', 'required', 'categories', 'my'] as const;
type TabKey = 'overview' | (typeof SECTIONS)[number];

function currentTab(pathname: string): TabKey {
  const section = pathname.slice(documentPaths.overview.length).split('/')[1] ?? '';
  return SECTIONS.find((k) => k === section) ?? 'overview';
}

/**
 * Documents (`/documents/*`): one lazy-loaded page. Roles that read beyond their own documents (HR, team managers,
 * payroll, recruitment) get the workspace — each list already limited by the API; everyone else gets "My documents".
 */
export default function DocumentsPage() {
  const { t } = useTranslation('documents');
  const { beyondOwn, canSeeCompliance, organization } = useDocumentsAccess();
  const { pathname } = useLocation();
  const tab = currentTab(pathname);
  const tabs: Array<{ key: TabKey; to: string; show: boolean }> = [
    { key: 'overview', to: documentPaths.overview, show: true },
    { key: 'directory', to: documentPaths.directory, show: true },
    { key: 'expiry', to: documentPaths.expiry, show: true },
    { key: 'required', to: documentPaths.required, show: canSeeCompliance },
    { key: 'categories', to: documentPaths.categories, show: organization },
    { key: 'my', to: documentPaths.my, show: true },
  ];
  const visible = tabs.filter((x) => x.show);
  const back = <Navigate to={documentPaths.overview} replace />;
  const when = (allowed: boolean, element: ReactNode) => (allowed ? element : back);

  return (
    <>
      <PageHeader title={beyondOwn ? t('title') : t('tabs.my')} subtitle={beyondOwn ? t('subtitle') : t('ownSubtitle')} />
      {beyondOwn && (
        <ModuleTabs
          label={t('tabs.label')}
          value={visible.some((item) => item.key === tab) ? tab : false}
          tabs={visible.map((item) => ({ key: item.key, to: item.to, label: t(`tabs.${item.key}`) }))}
        />
      )}
      <Routes>
        <Route index element={beyondOwn ? <OverviewSection /> : <MyDocuments />} />
        <Route path="directory" element={when(beyondOwn, <DirectorySection />)} />
        {/* Every role: the API returns only what the caller may see (anything else is "not found"). */}
        <Route path="directory/:documentId" element={<DocumentDetails />} />
        <Route path="expiry" element={when(beyondOwn, <ExpirySection />)} />
        <Route path="required" element={when(canSeeCompliance, <RequiredSection />)} />
        <Route path="categories" element={when(organization, <CategoriesSection />)} />
        <Route path="my" element={when(beyondOwn, <MyDocuments />)} />
        <Route path="*" element={back} />
      </Routes>
    </>
  );
}
