import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Paper from '@mui/material/Paper';
import Skeleton from '@mui/material/Skeleton';
import Typography from '@mui/material/Typography';
import type { SvgIconComponent } from '@mui/icons-material';
import AssignmentIndOutlined from '@mui/icons-material/AssignmentIndOutlined';
import DescriptionOutlined from '@mui/icons-material/DescriptionOutlined';
import EventAvailableOutlined from '@mui/icons-material/EventAvailableOutlined';
import MoreTimeOutlined from '@mui/icons-material/MoreTimeOutlined';
import PaymentsOutlined from '@mui/icons-material/PaymentsOutlined';
import WorkOutlineOutlined from '@mui/icons-material/WorkOutlineOutlined';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/core/context/authContext';
import { formatNumber } from '@/i18n/format';
import { useLanguage } from '@/i18n/useLanguage';
import { PENDING_ACTION_ACCESS } from '@/modules/dashboard/access';
import { usePendingActions } from '@/modules/dashboard/hooks/useDashboard';
import type { DashboardScope, PendingActionType } from '@/modules/dashboard/types/dashboard';

type PendingKey = 'leaveApprovals' | 'probationReviews' | 'documentsExpiring' | 'attendanceCorrections' | 'openPositions' | 'payrollChanges';

const PENDING: Record<PendingActionType, { key: PendingKey; icon: SvgIconComponent }> = {
  'leave-approvals': { key: 'leaveApprovals', icon: EventAvailableOutlined },
  'probation-reviews': { key: 'probationReviews', icon: AssignmentIndOutlined },
  'documents-expiring': { key: 'documentsExpiring', icon: DescriptionOutlined },
  'attendance-corrections': { key: 'attendanceCorrections', icon: MoreTimeOutlined },
  'open-positions': { key: 'openPositions', icon: WorkOutlineOutlined },
  'payroll-changes': { key: 'payrollChanges', icon: PaymentsOutlined },
};

/**
 * Outstanding items for the role — a summary only (counts); the workflows that resolve them arrive with
 * their modules in later phases, so the items are not links yet.
 */
export function PendingActions({ scope }: { scope: DashboardScope }) {
  const { t } = useTranslation('dashboard');
  const { t: tc } = useTranslation();
  const { language } = useLanguage();
  const { canAny } = useAuth();
  const visibleTypes = (Object.keys(PENDING_ACTION_ACCESS) as PendingActionType[]).filter((type) => canAny(PENDING_ACTION_ACCESS[type]));
  const query = usePendingActions(scope, visibleTypes.length > 0);
  if (visibleTypes.length === 0) return null;

  const items = query.data?.items.filter((item) => visibleTypes.includes(item.type) && item.count > 0) ?? [];

  return (
    <Paper variant="outlined" component="section" aria-labelledby="pending-title" sx={{ p: 2.5, minWidth: 0 }}>
      <Typography id="pending-title" variant="h6" component="h2">
        {t('pending.title')}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
        {t('pending.subtitle')}
      </Typography>
      {query.isPending && (
        <Box role="status" aria-label={tc('shell.loading')}>
          {[0, 1, 2].map((i) => (
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
          {t('pending.error')}
        </Alert>
      )}
      {query.data && items.length === 0 && <Typography color="text.secondary">{t('pending.empty')}</Typography>}
      {items.length > 0 && (
        <List disablePadding>
          {items.map((item) => {
            const meta = PENDING[item.type];
            const Icon = meta.icon;
            return (
              <ListItem key={item.type} disableGutters divider data-pending={item.type}>
                <ListItemIcon sx={{ minWidth: 40, color: 'primary.main' }}>
                  <Icon fontSize="small" />
                </ListItemIcon>
                <ListItemText primary={t(`pending.items.${meta.key}.label`)} secondary={t(`pending.items.${meta.key}.hint`)} />
                <Chip label={formatNumber(item.count, language)} color="primary" variant="outlined" size="small" sx={{ fontWeight: 700, ms: 1 }} />
              </ListItem>
            );
          })}
        </List>
      )}
    </Paper>
  );
}
