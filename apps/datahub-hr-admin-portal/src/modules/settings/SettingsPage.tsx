import type { ReactNode } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import ArrowBackOutlined from '@mui/icons-material/ArrowBackOutlined';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useBreadcrumbs } from '@/core/context/breadcrumbContext';
import { PageHeader } from '@/modules/shared/PageHeader';
import { SettingsHome } from '@/modules/settings/components/SettingsHome';
import { CalendarSection } from '@/modules/settings/components/sections/CalendarSection';
import { AuditSection, NotificationsSection, SecuritySection } from '@/modules/settings/components/sections/AdminSections';
import { GeneralSection, LocalizationSection } from '@/modules/settings/components/sections/GeneralSections';
import { AttendanceSection, CompanySection, DocumentsSection, LeaveSection, PayrollSection, PerformanceSection, RecruitmentSection, WorkflowsSection } from '@/modules/settings/components/sections/ModuleSections';
import { useSettingsAccess } from '@/modules/settings/hooks/useSettingsAccess';
import { settingsPaths } from '@/modules/settings/paths';
import { SETTINGS_CATEGORIES, type SettingsCategory } from '@/modules/settings/types/settings';

function currentCategory(pathname: string): SettingsCategory | null {
  const section = pathname.slice(settingsPaths.overview.length).split('/')[1] ?? '';
  return SETTINGS_CATEGORIES.find((c) => c === section) ?? null;
}

/**
 * System Settings (`/settings/*`): one lazy-loaded page for `hr.settings.manage` (System Administrator, HR Administrator).
 * The landing page lists the categories; each category is a sub-route. Sign-in & session settings and the demo reset
 * are editable by System Administrators only. The settings API checks the same rules on every call.
 */
export default function SettingsPage() {
  const { t } = useTranslation('settings');
  const access = useSettingsAccess();
  const { pathname } = useLocation();
  const category = currentCategory(pathname);
  useBreadcrumbs(category ? [{ label: t(`categories.${category}.title`) }] : []);
  const back = <Navigate to={settingsPaths.overview} replace />;
  const page = (c: SettingsCategory, element: ReactNode) => (access.visible(c) ? element : back);
  const readOnly = !access.manage;

  return (
    <>
      <PageHeader title={category ? t(`categories.${category}.title`) : t('title')} subtitle={category ? t(`categories.${category}.description`) : t('subtitle')} />
      <Alert severity="info" sx={{ mb: 2.5 }}>
        {t('demoNotice')}
      </Alert>
      {category && (
        <Box sx={{ mb: 2 }}>
          <Button component={RouterLink} to={settingsPaths.overview} startIcon={<ArrowBackOutlined sx={(theme) => ({ transform: theme.direction === 'rtl' ? 'scaleX(-1)' : undefined })} />}>
            {t('back')}
          </Button>
        </Box>
      )}
      <Routes>
        <Route index element={<SettingsHome />} />
        <Route path="general" element={page('general', <GeneralSection readOnly={readOnly} />)} />
        <Route path="company" element={page('company', <CompanySection />)} />
        <Route path="localization" element={page('localization', <LocalizationSection readOnly={readOnly} />)} />
        <Route path="calendar" element={page('calendar', <CalendarSection readOnly={readOnly} />)} />
        <Route path="attendance" element={page('attendance', <AttendanceSection />)} />
        <Route path="leave" element={page('leave', <LeaveSection />)} />
        <Route path="recruitment" element={page('recruitment', <RecruitmentSection />)} />
        <Route path="performance" element={page('performance', <PerformanceSection />)} />
        <Route path="payroll" element={page('payroll', <PayrollSection />)} />
        <Route path="documents" element={page('documents', <DocumentsSection />)} />
        <Route path="notifications" element={page('notifications', <NotificationsSection readOnly={readOnly} />)} />
        <Route path="workflows" element={page('workflows', <WorkflowsSection />)} />
        <Route path="security" element={page('security', <SecuritySection canEdit={access.canEditSecurity} />)} />
        <Route path="audit" element={page('audit', <AuditSection canReset={access.canResetAll} />)} />
        <Route path="*" element={back} />
      </Routes>
    </>
  );
}
