import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import LinearProgress from '@mui/material/LinearProgress';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Typography from '@mui/material/Typography';
import ArrowBackOutlined from '@mui/icons-material/ArrowBackOutlined';
import EditOutlined from '@mui/icons-material/EditOutlined';
import EventNoteOutlined from '@mui/icons-material/EventNoteOutlined';
import { useAuth } from '@/core/context/authContext';
import { navItem } from '@/core/routes/navigation';
import ToggleOffOutlined from '@mui/icons-material/ToggleOffOutlined';
import ToggleOnOutlined from '@mui/icons-material/ToggleOnOutlined';
import { useTranslation } from 'react-i18next';
import { lazy, Suspense, useEffect, useState } from 'react';
import { Link as RouterLink, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useBreadcrumbs } from '@/core/context/breadcrumbContext';
import { formatDate } from '@/i18n/format';
import { useLanguage } from '@/i18n/useLanguage';
import { Feedback } from '@/modules/shared/Feedback';
import { useFeedback } from '@/modules/shared/hooks/useFeedback';
import { QueryBoundary } from '@/modules/shared/Panel';
import { StatusChip } from '@/modules/shared/StatusChip';
import { useEmployeeAccess } from '@/modules/employees/hooks/useEmployeeAccess';
import { useEmployee } from '@/modules/employees/hooks/useEmployees';
import { useEmployeeStatusFlow } from '@/modules/employees/hooks/useEmployeeStatusFlow';
import { employeePaths } from '@/modules/employees/paths';
import type { Employee } from '@/modules/employees/types/employee';
import { displayName } from '@/modules/employees/utils/names';
import { EmployeeAvatar } from './EmployeeAvatar';
import { HistorySection } from './profile/HistorySection';
import { ContactSection, EmergencySection, EmploymentSection, OrganizationSection, PersonalSection } from './profile/ProfileSections';

/** Leave tab from Leave Management, loaded on demand (keeps the leave UI out of this page's chunk). */
const EmployeeLeaveTab = lazy(() => import('@/modules/leave').then((m) => ({ default: m.EmployeeLeaveTab })));
/** Performance tab from Performance Management, loaded on demand. */
// Documents Management owns every document (one source of truth); the profile shows its tab (lazy, no import cycle).
const EmployeeDocumentsTab = lazy(() => import('@/modules/documents').then((m) => ({ default: m.EmployeeDocumentsTab })));
const EmployeePerformanceTab = lazy(() => import('@/modules/performance').then((m) => ({ default: m.EmployeePerformanceTab })));

const TABS = ['personal', 'contact', 'employment', 'organization', 'emergency', 'documents', 'leave', 'performance', 'history'] as const;
type TabKey = (typeof TABS)[number];

/** Attendance history of an employee (Attendance module URL; built from the navigation map, no module import). */
const attendanceHistoryPath = (employeeId: string) => `${navItem('attendance').path}/history/${encodeURIComponent(employeeId)}`;

const backIconSx ={ transform: (theme: { direction: string }) => (theme.direction === 'rtl' ? 'scaleX(-1)' : undefined) };

/** `/employees/:employeeId` — header plus one tab per section (the tab is in the URL: `?tab=documents`). */
export function EmployeeProfile() {
  const { t } = useTranslation('employees');
  const { employeeId = '' } = useParams();
  const query = useEmployee(employeeId);

  return (
    <Stack spacing={2.5}>
      <div>
        <Button component={RouterLink} to={employeePaths.directory} size="small" startIcon={<ArrowBackOutlined sx={backIconSx} />}>
          {t('profile.back')}
        </Button>
      </div>
      <QueryBoundary query={query} notFoundText={t('profile.notFound')} forbiddenText={t('profile.forbidden')}>
        {query.data && <ProfileView employee={query.data} />}
      </QueryBoundary>
    </Stack>
  );
}

function ProfileView({ employee: e }: { employee: Employee }) {
  const { t } = useTranslation('employees');
  const { t: tCommon } = useTranslation();
  const { language } = useLanguage();
  const { canManage } = useEmployeeAccess();
  const { canAny } = useAuth();
  // Link to Attendance only for roles that may read other people's attendance (organization or team).
  const canSeeAttendance = canAny(['attendance:read', 'attendance:read:team']);
  // Leave tab (Leave Management) for roles that may read other people's leave; its API applies the same scope.
  const canSeeLeave = canAny(['leave:read', 'leave:read:team']);
  // Performance tab for roles that may read other people's performance (organization or team); the API scopes it.
  const canSeePerformance = canAny(['performance:read', 'performance:read:team']);
  // HR documents, the team's permitted documents, or payroll documents (payroll roles): the API filters each.
  const canReadDocuments = canAny(['documents:read', 'documents:read:team', 'payroll:read']);
  const feedback = useFeedback();
  const status = useEmployeeStatusFlow(feedback.notify);
  const [params, setParams] = useSearchParams();
  const name = displayName(e.name, language);
  useBreadcrumbs([{ label: name }]);

  // Confirmation passed by the create/edit form; cleared from history so a refresh does not repeat it.
  const location = useLocation();
  const navigate = useNavigate();
  const notice = (location.state as { notice?: string } | null)?.notice;
  const { notify } = feedback;
  useEffect(() => {
    if (!notice) return;
    notify(notice);
    navigate({ pathname: location.pathname, search: location.search }, { replace: true, state: null });
  }, [notice, notify, navigate, location.pathname, location.search]);

  const tabs = TABS.filter((key) => (key !== 'documents' || canReadDocuments) && (key !== 'emergency' || e.personal !== null) && (key !== 'leave' || canSeeLeave) && (key !== 'performance' || canSeePerformance));
  const requested = params.get('tab') as TabKey | null;
  const tab: TabKey = requested && tabs.includes(requested) ? requested : 'personal';
  // Today's date, fixed for the life of the view (render must stay pure).
  const [today] = useState(() => new Date().toISOString().slice(0, 10));
  const onProbation = e.probationEndDate !== null && e.probationEndDate >= today;

  return (
    <>
      <Paper variant="outlined" sx={{ overflow: 'hidden' }}>
        <Box sx={{ p: { xs: 2, sm: 3 }, display: 'flex', flexWrap: 'wrap', gap: 2.5, alignItems: 'center' }}>
        <EmployeeAvatar id={e.id} name={e.name} size={72} />
        <Box sx={{ flex: '1 1 260px', minWidth: 0 }}>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1.25 }}>
            <Typography variant="h5" component="h2" sx={{ overflowWrap: 'anywhere' }}>
              {name}
            </Typography>
            <Chip size="small" variant="outlined" label={e.employeeNumber} dir="ltr" sx={{ fontFamily: 'monospace' }} />
            <StatusChip status={e.status} />
            {onProbation && <Chip size="small" color="info" variant="outlined" label={t('profile.probation', { date: formatDate(e.probationEndDate!, language) })} />}
          </Box>
          <Typography color="text.secondary" sx={{ mt: 0.5 }}>
            {e.position.name[language]} · {e.department.name[language]}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t('fields.hireDate')}: {formatDate(e.hireDate, language)}
          </Typography>
        </Box>
        {(canManage || canSeeAttendance) && (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            {canSeeAttendance && (
              <Button component={RouterLink} to={attendanceHistoryPath(e.id)} variant="outlined" startIcon={<EventNoteOutlined />}>
                {t('actions.attendance')}
              </Button>
            )}
            {canManage && (
              <>
                <Button component={RouterLink} to={employeePaths.edit(e.id)} variant="outlined" startIcon={<EditOutlined />}>
                  {t('actions.edit')}
                </Button>
                <Button
                  variant="outlined"
                  color={e.status === 'active' ? 'error' : 'primary'}
                  startIcon={e.status === 'active' ? <ToggleOffOutlined /> : <ToggleOnOutlined />}
                  onClick={() => status.request(e)}
                >
                  {e.status === 'active' ? t('actions.deactivate') : t('actions.activate')}
                </Button>
              </>
            )}
          </Box>
        )}
        </Box>
        <Tabs
          aria-label={t('profile.tabsLabel')}
          value={tab}
          variant="scrollable"
          scrollButtons={false}
          onChange={(_, value: TabKey) => setParams(value === 'personal' ? {} : { tab: value }, { replace: true })}
          sx={{ px: { xs: 1, sm: 2 }, borderTop: 1, borderColor: 'divider' }}
        >
          {tabs.map((key) => (
            <Tab key={key} value={key} label={t(`profile.tabs.${key}`)} id={`employee-tab-${key}`} aria-controls="employee-tabpanel" />
          ))}
        </Tabs>
      </Paper>

      <Box role="tabpanel" id="employee-tabpanel" aria-labelledby={`employee-tab-${tab}`} sx={{ pt: 2.5 }}>
        {tab === 'personal' && <PersonalSection employee={e} />}
        {tab === 'contact' && <ContactSection employee={e} />}
        {tab === 'employment' && <EmploymentSection employee={e} />}
        {tab === 'organization' && <OrganizationSection employee={e} />}
        {tab === 'emergency' && <EmergencySection employee={e} />}
        {tab === 'documents' && (
          <Suspense fallback={<LinearProgress aria-label={tCommon('shell.loading')} />}>
            <EmployeeDocumentsTab employeeId={e.id} />
          </Suspense>
        )}
        {tab === 'leave' && (
          <Suspense fallback={<LinearProgress aria-label={tCommon('shell.loading')} />}>
            <EmployeeLeaveTab employeeId={e.id} />
          </Suspense>
        )}
        {tab === 'performance' && (
          <Suspense fallback={<LinearProgress aria-label={tCommon('shell.loading')} />}>
            <EmployeePerformanceTab employeeId={e.id} />
          </Suspense>
        )}
        {tab === 'history' && <HistorySection employeeId={e.id} />}
      </Box>
      {status.dialog}
      <Feedback {...feedback} />
    </>
  );
}
