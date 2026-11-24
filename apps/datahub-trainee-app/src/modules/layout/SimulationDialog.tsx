import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import Typography from '@mui/material/Typography';
import { useAuth } from '@/core/auth/authContext';
import { useT } from '@/i18n/useT';
import { useSimulationProfiles } from '@/modules/auth';
import { LoadingState } from '@/modules/shared/states';
import { UserAvatar } from '@/modules/shared/UserAvatar';
import { StatusChip } from '@/modules/shared/StatusChip';
import { ErrorState } from '@/modules/shared/states';

/**
 * "View as" (mock only): pick a user of the SIMULATED training directory to act as, so every role and department
 * rule can be tried. It changes the training business identity only — never the Workspace session, token or
 * Workspace permissions.
 */
export function SimulationDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useT();
  const { actor, simulation } = useAuth();
  const profiles = useSimulationProfiles(open && simulation.enabled);

  const choose = (userId: string | null) => {
    simulation.setSimulatedUser(userId);
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm" aria-labelledby="simulation-title">
      <DialogTitle id="simulation-title">{t.simulation.title}</DialogTitle>
      <DialogContent>
        <Alert severity="info" sx={{ mb: 2 }}>
          {t.simulation.notice}
        </Alert>
        {profiles.isLoading && <LoadingState minHeight={160} />}
        {profiles.isError && <ErrorState error={profiles.error} onRetry={() => profiles.refetch()} dense />}
        {profiles.data && (
          <List dense disablePadding aria-label={t.simulation.title}>
            {profiles.data.map((profile) => (
              <ListItemButton key={profile.userId} selected={profile.userId === actor?.userId} onClick={() => choose(profile.userId)} sx={{ gap: 1.5, py: 1 }}>
                <UserAvatar name={profile.fullName} size={34} />
                <ListItemText primary={profile.fullName} secondary={profile.departmentName ?? t.common.noDepartment} />
                <StatusChip kind="role" value={profile.role} />
              </ListItemButton>
            ))}
          </List>
        )}
        {simulation.simulatedUserId && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
            {t.simulation.active}
          </Typography>
        )}
      </DialogContent>
      <DialogActions>
        {simulation.simulatedUserId && (
          <Button onClick={() => choose(null)} color="inherit">
            {t.simulation.reset}
          </Button>
        )}
        <Button onClick={onClose}>{t.common.close}</Button>
      </DialogActions>
    </Dialog>
  );
}
