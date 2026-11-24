import { useState } from 'react';
import Badge from '@mui/material/Badge';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Popover from '@mui/material/Popover';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import NotificationsNoneIcon from '@mui/icons-material/NotificationsNone';
import { useT } from '@/i18n/useT';
import { ActivityList, useRecentActivity } from '@/modules/dashboard';
import { EmptyState, ErrorState, LoadingState } from '@/modules/shared/states';

const STORAGE_KEY = 'datahub-trainee.notifications-seen';

function readSeen(): number {
  try {
    return Number(localStorage.getItem(STORAGE_KEY)) || 0;
  } catch {
    return 0;
  }
}

/** Recent activity as a notifications popover. The dot shows events newer than the last time it was opened. */
export function NotificationsMenu() {
  const t = useT();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [seen, setSeen] = useState(readSeen);
  const activity = useRecentActivity(6);
  const unread = (activity.data ?? []).filter((item) => Date.parse(item.at) > seen).length;

  const open = (element: HTMLElement) => {
    setAnchor(element);
    const now = Date.now();
    setSeen(now);
    try {
      localStorage.setItem(STORAGE_KEY, String(now));
    } catch {
      // Storage unavailable.
    }
  };

  return (
    <>
      <Tooltip title={t.shell.notifications}>
        <IconButton onClick={(e) => open(e.currentTarget)} aria-label={t.shell.notifications} aria-haspopup="dialog">
          <Badge color="error" variant="dot" invisible={unread === 0}>
            <NotificationsNoneIcon />
          </Badge>
        </IconButton>
      </Tooltip>
      <Popover open={anchor !== null} anchorEl={anchor} onClose={() => setAnchor(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }} transformOrigin={{ vertical: 'top', horizontal: 'right' }} slotProps={{ paper: { sx: { width: 380, maxWidth: 'calc(100vw - 24px)', mt: 1 } } }}>
        <Box sx={{ px: 2, py: 1.5, borderBottom: 1, borderColor: 'divider' }}>
          <Typography variant="subtitle1" component="h2">
            {t.shell.notifications}
          </Typography>
        </Box>
        <Box sx={{ maxHeight: 420, overflowY: 'auto' }}>
          {activity.isLoading && <LoadingState minHeight={140} />}
          {activity.isError && <ErrorState error={activity.error} onRetry={() => activity.refetch()} dense />}
          {activity.data && activity.data.length === 0 && <EmptyState dense title={t.shell.noNotifications} />}
          {activity.data && activity.data.length > 0 && <ActivityList items={activity.data} dense />}
        </Box>
      </Popover>
    </>
  );
}
