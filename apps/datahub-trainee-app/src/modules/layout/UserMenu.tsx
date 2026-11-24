import { useState } from 'react';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Divider from '@mui/material/Divider';
import ListItemIcon from '@mui/material/ListItemIcon';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Typography from '@mui/material/Typography';
import LogoutIcon from '@mui/icons-material/Logout';
import SwitchAccountOutlinedIcon from '@mui/icons-material/SwitchAccountOutlined';
import { useAuth } from '@/core/auth/authContext';
import { workspaceLogoutUrl } from '@/core/config/workspace';
import { useLocale } from '@/i18n/LocaleContext';
import { useT } from '@/i18n/useT';
import { StatusChip } from '@/modules/shared/StatusChip';
import { UserAvatar } from '@/modules/shared/UserAvatar';
import { SimulationDialog } from './SimulationDialog';

/** The signed-in person: name, role, "view as" (mock) and Sign out (to the Workspace logout). */
export function UserMenu() {
  const t = useT();
  const { locale } = useLocale();
  const { user, actor, signOut, signOutTo, simulation } = useAuth();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [simulationOpen, setSimulationOpen] = useState(false);
  if (!user || !actor) return null;

  const logout = () => {
    setAnchor(null);
    const url = workspaceLogoutUrl(locale);
    if (url) signOutTo(url);
    else signOut();
  };

  return (
    <>
      <IconButton onClick={(e) => setAnchor(e.currentTarget)} aria-label={t.shell.userMenu} aria-haspopup="menu" aria-expanded={!!anchor} sx={{ p: 0.5 }}>
        <UserAvatar name={actor.fullName} size={34} />
      </IconButton>
      <Menu anchorEl={anchor} open={anchor !== null} onClose={() => setAnchor(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }} transformOrigin={{ vertical: 'top', horizontal: 'right' }}>
        <Box sx={{ px: 1.5, py: 1, minWidth: 240 }}>
          <Typography sx={{ fontWeight: 600 }}>{actor.fullName}</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>
            {actor.email}
          </Typography>
          <Box sx={{ mt: 1 }}>
            <StatusChip kind="role" value={actor.role} />
          </Box>
          {simulation.simulatedUserId && (
            <Typography variant="caption" color="warning.main" sx={{ display: 'block', mt: 1, fontWeight: 600 }}>
              {t.simulation.banner}
            </Typography>
          )}
        </Box>
        <Divider />
        {simulation.enabled && (
          <MenuItem
            onClick={() => {
              setAnchor(null);
              setSimulationOpen(true);
            }}
          >
            <ListItemIcon>
              <SwitchAccountOutlinedIcon fontSize="small" />
            </ListItemIcon>
            {t.simulation.menuItem}
          </MenuItem>
        )}
        <MenuItem onClick={logout}>
          <ListItemIcon>
            <LogoutIcon fontSize="small" />
          </ListItemIcon>
          {t.shell.signOut}
        </MenuItem>
      </Menu>
      <SimulationDialog open={simulationOpen} onClose={() => setSimulationOpen(false)} />
    </>
  );
}
