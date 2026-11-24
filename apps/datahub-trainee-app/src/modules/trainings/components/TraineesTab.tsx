import { Link as RouterLink } from 'react-router-dom';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import GroupsOutlinedIcon from '@mui/icons-material/GroupsOutlined';
import WorkspacePremiumOutlinedIcon from '@mui/icons-material/WorkspacePremiumOutlined';
import { ROUTES } from '@/core/routes/paths';
import { formatDate } from '@/i18n/format';
import { useLocale } from '@/i18n/LocaleContext';
import { useT } from '@/i18n/useT';
import { DataTable, type Column } from '@/modules/shared/DataTable';
import { ProgressIndicator } from '@/modules/shared/ProgressIndicator';
import { StatusChip } from '@/modules/shared/StatusChip';
import { UserAvatar } from '@/modules/shared/UserAvatar';
import { useTrainingRoster } from '../hooks/useTrainings';
import type { TrainingRosterEntry } from '../types/training';

/** Who is enrolled in this training and how far they are (staff). Enrollments themselves are managed in Enrollments. */
export function TraineesTab({ trainingId }: { trainingId: string }) {
  const t = useT();
  const { locale } = useLocale();
  const query = useTrainingRoster(trainingId, true);

  const columns: Column<TrainingRosterEntry>[] = [
    {
      id: 'user',
      header: t.enrollments.columns.trainee,
      render: (e) => (
        <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
          <UserAvatar name={e.userName} size={32} />
          <Box>
            <Typography sx={{ fontWeight: 600 }}>{e.userName}</Typography>
            <Typography variant="body2" color="text.secondary">
              {t.roles[e.userRole]}
            </Typography>
          </Box>
        </Stack>
      ),
    },
    { id: 'status', header: t.enrollments.columns.status, render: (e) => <StatusChip kind="enrollment" value={e.status} /> },
    { id: 'progress', header: t.enrollments.columns.progress, width: 220, hideBelow: 'sm', render: (e) => <ProgressIndicator value={e.progress} /> },
    { id: 'assigned', header: t.enrollments.columns.assigned, hideBelow: 'md', render: (e) => formatDate(e.assignedAt, locale) },
    { id: 'completed', header: t.enrollments.columns.completed, hideBelow: 'md', render: (e) => formatDate(e.completedAt, locale) },
    {
      id: 'actions',
      header: t.common.actions,
      align: 'right',
      width: 70,
      render: (e) =>
        e.status === 'completed' ? (
          <Tooltip title={t.certificates.view}>
            <IconButton size="small" component={RouterLink} to={ROUTES.certificate(e.enrollmentId)} aria-label={`${t.certificates.view}: ${e.userName}`}>
              <WorkspacePremiumOutlinedIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        ) : null,
    },
  ];

  return (
    <Card sx={{ boxShadow: 'none', border: 0 }}>
      <DataTable
        label={t.trainings.tabs.trainees}
        columns={columns}
        rows={query.data}
        getRowId={(e) => e.enrollmentId}
        isLoading={query.isLoading}
        error={query.error}
        onRetry={() => query.refetch()}
        empty={{ title: t.trainings.trainees.empty.title, description: t.trainings.trainees.empty.body, icon: <GroupsOutlinedIcon /> }}
      />
    </Card>
  );
}
