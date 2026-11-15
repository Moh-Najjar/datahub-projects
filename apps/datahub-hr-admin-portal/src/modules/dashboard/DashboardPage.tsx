import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/core/context/authContext';
import { dashboardScope, WIDGET_ACCESS } from '@/modules/dashboard/access';
import { AttendanceChart } from '@/modules/dashboard/components/charts/AttendanceChart';
import { DepartmentChart } from '@/modules/dashboard/components/charts/DepartmentChart';
import { EmployeeGrowthChart } from '@/modules/dashboard/components/charts/EmployeeGrowthChart';
import { LeaveChart } from '@/modules/dashboard/components/charts/LeaveChart';
import { KpiCards } from '@/modules/dashboard/components/KpiCards';
import { PendingActions } from '@/modules/dashboard/components/PendingActions';
import { RecentActivity } from '@/modules/dashboard/components/RecentActivity';
import { WelcomeHeader } from '@/modules/dashboard/components/WelcomeHeader';

/**
 * HR dashboard: welcome, KPIs, charts, pending actions and recent activity. Every section is shown only to
 * roles whose permissions include it, and fetches its own data (each section = one query). Fictional data.
 */
export default function DashboardPage() {
  const { t } = useTranslation('dashboard');
  const { can, canAny } = useAuth();
  const scope = dashboardScope(can);

  const charts = [
    canAny(WIDGET_ACCESS.headcount) && <EmployeeGrowthChart key="growth" scope={scope} />,
    canAny(WIDGET_ACCESS.attendance) && <AttendanceChart key="attendance" scope={scope} />,
    scope === 'organization' && canAny(WIDGET_ACCESS.departments) && <DepartmentChart key="departments" />,
    canAny(WIDGET_ACCESS.leave) && <LeaveChart key="leave" scope={scope} />,
  ].filter(Boolean);

  return (
    <>
      <WelcomeHeader scope={scope} />
      <KpiCards scope={scope} />

      {charts.length > 0 && (
        <Box sx={{ display: 'grid', gap: 2, mb: 3, gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 440px), 1fr))' }}>{charts}</Box>
      )}

      <Box sx={{ display: 'grid', gap: 2, mb: 2, gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 2fr) minmax(0, 3fr)' }, alignItems: 'start' }}>
        <PendingActions scope={scope} />
        <RecentActivity scope={scope} />
      </Box>

      <Typography variant="caption" color="text.secondary">
        {t('demoDataNote')}
      </Typography>
    </>
  );
}
