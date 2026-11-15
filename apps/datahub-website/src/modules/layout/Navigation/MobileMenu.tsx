import { useState } from 'react';
import Box from '@mui/material/Box';
import Collapse from '@mui/material/Collapse';
import Drawer from '@mui/material/Drawer';
import IconButton from '@mui/material/IconButton';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import Typography from '@mui/material/Typography';
import CloseIcon from '@mui/icons-material/Close';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import { Link } from 'react-router-dom';
import { SmartLink } from '@/modules/shared/SmartLink';
import { PRIMARY_NAV } from '@/core/config/navigation';
import { useAlternateHref } from '@/i18n/useAlternateHref';
import { useLocale, useLocalized } from '@/i18n/LocaleContext';
import { UI } from '@/i18n';
import type { NavItem, NavLink } from '@/core/types/navigation';
import { Logo } from '@/modules/layout/Header/Logo';

export const MOBILE_MENU_WIDTH = 'min(540px, 80vw)';

interface MobileMenuProps {
  open: boolean;
  onClose: () => void;
}

const LANGUAGE_LABEL = { en: 'English', ar: 'العربية' } as const;

const rowLinkSx = {
  display: 'block',
  flex: 1,
  py: '19px',
  pl: 0,
  pr: '50px',
  color: 'common.white',
  fontSize: 16,
  lineHeight: 1.5,
  textAlign: 'left',
  background: 'none',
  border: 0,
  cursor: 'pointer',
  '&:hover, &:focus-visible': { color: 'common.white', opacity: 0.8 },
} as const;

const subLinkSx = {
  display: 'block',
  py: '8px',
  color: 'rgba(255,255,255,0.7)',
  fontSize: 14,
  lineHeight: 1.5,
  '&:hover, &:focus-visible': { color: 'common.white' },
} as const;

function SubLinks({ links, onNavigate }: { links: NavLink[]; onNavigate: () => void }) {
  return (
    <Box component="ul">
      {links.map((l) => (
        <li key={l.href + l.label}>
          <Box component={SmartLink} href={l.href} locale={l.locale} onClick={onNavigate} sx={subLinkSx}>
            {l.label}
          </Box>
        </li>
      ))}
    </Box>
  );
}

function Children({ item, onNavigate }: { item: NavItem; onNavigate: () => void }) {
  if (item.kind === 'dropdown') {
    return (
      <Box sx={{ pt: '4px', pb: '18px', pl: '30px' }}>
        <SubLinks links={item.items} onNavigate={onNavigate} />
      </Box>
    );
  }
  if (item.kind === 'mega') {
    return (
      <Box sx={{ pl: '32px' }}>
        {item.columns.map((col) => (
          <Box key={col.title} sx={{ my: '30px' }}>
            <Typography component="h2" sx={{ mb: '14px', color: 'common.white', fontSize: 15, fontWeight: 500, textTransform: 'uppercase' }}>
              {col.title}
            </Typography>
            <Box sx={{ pl: '10px' }}>
              <SubLinks links={[...col.links, col.more]} onNavigate={onNavigate} />
            </Box>
          </Box>
        ))}
      </Box>
    );
  }
  return null;
}

/**
 * Off-canvas mobile navigation: MUI `Drawer` (anchor flips automatically in RTL)
 * with the original theme's green panel and accordion submenus.
 */
export function MobileMenu({ open, onClose }: MobileMenuProps) {
  const items = useLocalized(PRIMARY_NAV);
  const ui = useLocalized(UI);
  const { locale } = useLocale();
  const altHref = useAlternateHref();
  const [expanded, setExpanded] = useState<number | null>(null);
  const other = locale === 'en' ? 'ar' : 'en';

  return (
    <Drawer
      id="mobile-menu"
      anchor="right"
      open={open}
      onClose={onClose}
      slotProps={{
        transition: { onExited: () => setExpanded(null) },
        paper: { sx: { width: MOBILE_MENU_WIDTH, bgcolor: 'secondary.main', backgroundImage: 'none' }, 'aria-label': ui.openMenu },
        backdrop: { sx: { bgcolor: 'transparent' } },
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0, height: 80, px: '30px', bgcolor: 'common.white' }}>
        <Box sx={{ width: 155 }}>
          <Logo />
        </Box>
        <IconButton
          onClick={onClose}
          aria-label={ui.closeMenu}
          sx={{ color: 'common.black', p: 0, transition: 'transform .3s', '&:hover': { transform: 'rotate(90deg)', bgcolor: 'transparent' } }}
        >
          <CloseIcon sx={{ fontSize: 32 }} />
        </IconButton>
      </Box>

      <Box component="nav" aria-label="Mobile" sx={{ flex: 1, overflowY: 'auto', px: '30px', pt: '20px', pb: '30px' }}>
        <List disablePadding>
          {items.map((item, index) => {
            const hasChildren = item.kind !== 'link';
            const isOpen = expanded === index;
            const href = item.kind === 'mega' ? undefined : item.href;
            const toggle = () => setExpanded(isOpen ? null : index);
            const panelId = `mobile-sub-${index}`;
            return (
              <ListItem key={item.label} disablePadding sx={{ display: 'block', borderBottom: '1px solid rgba(255,255,255,0.15)' }}>
                <Box sx={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  {href ? (
                    <Box component={SmartLink} href={href} onClick={onClose} sx={rowLinkSx}>
                      {item.label}
                    </Box>
                  ) : (
                    <Box component="button" type="button" onClick={toggle} sx={rowLinkSx}>
                      {item.label}
                    </Box>
                  )}
                  {hasChildren && (
                    <IconButton
                      onClick={toggle}
                      aria-expanded={isOpen}
                      aria-controls={panelId}
                      aria-label={ui.toggleSubmenu}
                      sx={{
                        position: 'absolute',
                        right: 0,
                        width: 40,
                        height: 40,
                        borderRadius: 0,
                        color: 'common.white',
                        bgcolor: 'rgba(255,255,255,0.1)',
                        '&:hover': { bgcolor: 'rgba(255,255,255,0.2)' },
                      }}
                    >
                      {isOpen ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
                    </IconButton>
                  )}
                </Box>
                {hasChildren && (
                  <Collapse in={isOpen} id={panelId} timeout={300}>
                    <Children item={item} onNavigate={onClose} />
                  </Collapse>
                )}
              </ListItem>
            );
          })}
          <ListItem disablePadding>
            <Box component={Link} to={altHref(other)} hrefLang={other} lang={other} onClick={onClose} sx={rowLinkSx}>
              {LANGUAGE_LABEL[other]}
            </Box>
          </ListItem>
        </List>
      </Box>
    </Drawer>
  );
}
