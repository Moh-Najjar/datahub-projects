import { useState } from 'react';
import IconButton from '@mui/material/IconButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import MoreVertOutlined from '@mui/icons-material/MoreVertOutlined';
import type { SvgIconComponent } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

export interface RowAction {
  label: string;
  icon: SvgIconComponent;
  /** Either navigate… */
  to?: string;
  /** …or run an action. */
  onClick?: () => void;
}

/** "⋮" menu with a row's actions. Its accessible name includes the row's name. */
export function RowActions({ name, actions }: { name: string; actions: readonly RowAction[] }) {
  const { t } = useTranslation();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  if (actions.length === 0) return null;
  const close = () => setAnchor(null);

  return (
    <>
      <IconButton size="small" aria-label={t('list.actionsFor', { name })} aria-haspopup="menu" aria-expanded={Boolean(anchor)} onClick={(e) => setAnchor(e.currentTarget)}>
        <MoreVertOutlined fontSize="small" />
      </IconButton>
      <Menu anchorEl={anchor} open={Boolean(anchor)} onClose={close} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }} transformOrigin={{ vertical: 'top', horizontal: 'right' }}>
        {actions.map(({ label, icon: Icon, to, onClick }) => {
          const content = (
            <>
              <ListItemIcon>
                <Icon fontSize="small" />
              </ListItemIcon>
              <ListItemText>{label}</ListItemText>
            </>
          );
          return to ? (
            <MenuItem key={label} component={Link} to={to} onClick={close}>
              {content}
            </MenuItem>
          ) : (
            <MenuItem
              key={label}
              onClick={() => {
                close();
                onClick?.();
              }}
            >
              {content}
            </MenuItem>
          );
        })}
      </Menu>
    </>
  );
}
