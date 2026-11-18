import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemAvatar from '@mui/material/ListItemAvatar';
import ListItemText from '@mui/material/ListItemText';
import Paper from '@mui/material/Paper';
import Skeleton from '@mui/material/Skeleton';
import Typography from '@mui/material/Typography';
import type { SvgIconComponent } from '@mui/icons-material';
import AccessTimeOutlined from '@mui/icons-material/AccessTimeOutlined';
import AdminPanelSettingsOutlined from '@mui/icons-material/AdminPanelSettingsOutlined';
import EditNoteOutlined from '@mui/icons-material/EditNoteOutlined';
import EventAvailableOutlined from '@mui/icons-material/EventAvailableOutlined';
import EventNoteOutlined from '@mui/icons-material/EventNoteOutlined';
import PersonAddAlt1Outlined from '@mui/icons-material/PersonAddAlt1Outlined';
import WorkOutlineOutlined from '@mui/icons-material/WorkOutlineOutlined';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/core/context/authContext';
import { formatDate } from '@/i18n/format';
import { useLanguage } from '@/i18n/useLanguage';
import { ACTIVITY_ACCESS } from '@/modules/dashboard/access';
import { useRecentActivity } from '@/modules/dashboard/hooks/useDashboard';
import type { ActivityType, DashboardScope } from '@/modules/dashboard/types/dashboard';

type ActivityKey = 'employeeAdded' | 'employeeUpdated' | 'leaveSubmitted' | 'leaveApproved' | 'attendanceUpdated' | 'positionCreated' | 'userRoleChanged';

const ACTIVITY: Record<ActivityType, { key: ActivityKey; icon: SvgIconComponent; color: 'primary' | 'secondary' | 'info' | 'warning' | 'success' | 'error' }> = {
  'employee-added': { key: 'employeeAdded', icon: PersonAddAlt1Outlined, color: 'primary' },
  'employee-updated': { key: 'employeeUpdated', icon: EditNoteOutlined, color: 'info' },
  'leave-submitted': { key: 'leaveSubmitted', icon: EventNoteOutlined, color: 'warning' },
  'leave-approved': { key: 'leaveApproved', icon: EventAvailableOutlined, color: 'success' },
  'attendance-updated': { key: 'attendanceUpdated', icon: AccessTimeOutlined, color: 'secondary' },
  'position-created': { key: 'positionCreated', icon: WorkOutlineOutlined, color: 'primary' },
  'user-role-changed': { key: 'userRoleChanged', icon: AdminPanelSettingsOutlined, color: 'error' },
};

/** Latest HR events the role may see (type-filtered by permission). */
export function RecentActivity({ scope }: { scope: DashboardScope }) {
  const { t } = useTranslation('dashboard');
  const { t: tc } = useTranslation();
  const { language } = useLanguage();
  const { canAny } = useAuth();
  const visibleTypes = (Object.keys(ACTIVITY_ACCESS) as ActivityType[]).filter((type) => canAny(ACTIVITY_ACCESS[type]));
  const query = useRecentActivity(scope, visibleTypes.length > 0);
  if (visibleTypes.length === 0) return null;

  const items = query.data?.items.filter((item) => visibleTypes.includes(item.type)) ?? [];

  return (
    <Paper variant="outlined" component="section" aria-labelledby="activity-title" sx={{ p: { xs: 2, sm: 2.5 }, minWidth: 0, height: '100%' }}>
      <Typography id="activity-title" variant="h6" component="h2" sx={{ mb: 1.5, pb: 1.5, borderBottom: 1, borderColor: 'divider' }}>
        {t('activity.title')}
      </Typography>
      {query.isPending && (
        <Box role="status" aria-label={tc('shell.loading')}>
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} height={56} />
          ))}
        </Box>
      )}
      {query.isError && (
        <Alert
          severity="error"
          action={
            <Button color="inherit" size="small" onClick={() => void query.refetch()}>
              {tc('actions.retry')}
            </Button>
          }
        >
          {t('activity.error')}
        </Alert>
      )}
      {query.data && items.length === 0 && <Typography color="text.secondary">{t('activity.empty')}</Typography>}
      {items.length > 0 && (
        <List disablePadding>
          {items.map((item) => {
            const meta = ACTIVITY[item.type];
            const Icon = meta.icon;
            return (
              <ListItem key={item.id} disableGutters divider alignItems="flex-start">
                <ListItemAvatar sx={{ minWidth: 48 }}>
                  <Box
                    aria-hidden="true"
                    sx={(theme) => ({
                      width: 34,
                      height: 34,
                      borderRadius: '50%',
                      display: 'grid',
                      placeItems: 'center',
                      color: `${meta.color}.main`,
                      bgcolor: theme.alpha((theme.vars ?? theme).palette[meta.color].main, 0.12),
                    })}
                  >
                    <Icon sx={{ fontSize: 18 }} />
                  </Box>
                </ListItemAvatar>
                <ListItemText
                  primary={t(`activity.types.${meta.key}`, { subject: item.subject[language] })}
                  secondary={`${t(`activity.typeLabels.${meta.key}`)} · ${t('activity.by', { actor: item.actor[language] })} · ${formatDate(item.occurredAt, language, { dateStyle: 'medium', timeStyle: 'short' })}`}
                />
              </ListItem>
            );
          })}
        </List>
      )}
    </Paper>
  );
}
