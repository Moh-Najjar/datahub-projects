import { memo, type ReactNode } from 'react';
import Box from '@mui/material/Box';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import { SmartLink } from '@/shared/components/ui/SmartLink';
import { PRIMARY_NAV } from '@/shared/config/navigation';
import { useIsActive } from '@/hooks/useActivePath';
import { useHoverMenu } from '@/hooks/useHoverMenu';
import { useLocalized } from '@/i18n/LocaleContext';
import type { NavItem, NavLink } from '@/shared/types/navigation';
import { MegaMenu } from '../MegaMenu/MegaMenu';
import { DropdownPanel, MenuItem, MenuList, subLinkSx } from './DesktopNav.styles';
import { LanguageSwitcher } from './LanguageSwitcher';

/**
 * Hrefs that make an item "current" (WordPress current-menu-item / -ancestor). The mega menu
 * is a widget area on the original, not real child items, so it is never highlighted.
 */
function hrefsOf(item: NavItem): string[] {
  if (item.kind === 'link') return [item.href];
  if (item.kind === 'dropdown') return [item.href ?? '', ...item.items.map((i) => i.href)];
  return [];
}

export const Chevron = () => <KeyboardArrowDownIcon aria-hidden sx={{ fontSize: 15, mt: '1px' }} />;

interface TopItemProps {
  label: string;
  href?: string;
  active: boolean;
  mega?: boolean;
  lang?: string;
  /** Dropdown content; omitted for plain links. */
  renderMenu?: (open: boolean, close: () => void) => ReactNode;
}

/** A top-level menu entry with an optional hover/focus dropdown. */
export function TopItem({ label, href, active, mega, lang, renderMenu }: TopItemProps) {
  const { open, close, itemProps } = useHoverMenu();
  const hasMenu = Boolean(renderMenu);
  const content = (
    <span className="nav-wrap">
      {label}
      {hasMenu && <Chevron />}
    </span>
  );

  return (
    <MenuItem active={active} open={open} mega={mega} {...(hasMenu ? itemProps : {})}>
      {href ? (
        <SmartLink
          href={href}
          className="nav-link"
          aria-haspopup={hasMenu || undefined}
          aria-expanded={hasMenu ? open : undefined}
          aria-current={active && !hasMenu ? 'page' : undefined}
        >
          {content}
        </SmartLink>
      ) : (
        <button type="button" className="nav-link" aria-haspopup="true" aria-expanded={open} lang={lang}>
          {content}
        </button>
      )}
      {renderMenu?.(open, close)}
    </MenuItem>
  );
}

interface DropdownProps {
  items: NavLink[];
  open: boolean;
  onNavigate: () => void;
}

/** Standard dropdown list (XaaS, Industries, Career). */
export function Dropdown({ items, open, onNavigate }: DropdownProps) {
  return (
    <DropdownPanel open={open} sx={{ left: 0, minWidth: 240, pt: '18px', pb: '22px', boxShadow: (t) => t.customShadows.submenu }}>
      <Box component="ul">
        {items.map((link) => (
          <li key={link.href + link.label}>
            <Box
              component={SmartLink}
              href={link.href}
              locale={link.locale}
              onClick={onNavigate}
              sx={{ ...subLinkSx, px: '30px', whiteSpace: 'nowrap' }}
            >
              <span className="sub-label">{link.label}</span>
            </Box>
          </li>
        ))}
      </Box>
    </DropdownPanel>
  );
}

function DesktopNavComponent() {
  const items = useLocalized(PRIMARY_NAV);
  const isActive = useIsActive();

  return (
    <Box component="nav" aria-label="Primary" sx={{ flex: 1, height: '100%' }}>
      <MenuList>
        {items.map((item) => {
          const active = hrefsOf(item).some(isActive);
          switch (item.kind) {
            case 'link':
              return <TopItem key={item.label} label={item.label} href={item.href} active={active} />;
            case 'dropdown':
              return (
                <TopItem
                  key={item.label}
                  label={item.label}
                  href={item.href}
                  active={active}
                  renderMenu={(open, close) => <Dropdown items={item.items} open={open} onNavigate={close} />}
                />
              );
            case 'mega':
              return (
                <TopItem
                  key={item.label}
                  label={item.label}
                  active={active}
                  mega
                  renderMenu={(open, close) => <MegaMenu columns={item.columns} open={open} onNavigate={close} />}
                />
              );
          }
        })}
        <LanguageSwitcher />
      </MenuList>
    </Box>
  );
}

export const DesktopNav = memo(DesktopNavComponent);
