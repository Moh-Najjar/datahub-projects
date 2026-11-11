import Box from '@mui/material/Box';
import { Link } from 'react-router-dom';
import { useAlternateHref } from '@/hooks/useAlternateLocale';
import { useLocale } from '@/i18n/LocaleContext';
import { TopItem } from './DesktopNav';
import { DropdownPanel, subLinkSx } from './DesktopNav.styles';

/** Labels as rendered by WPML on the original ("العربية (Arabic)" under English). */
const OPTION_LABEL = { en: 'English', ar: 'العربية (Arabic)' } as const;
const CURRENT_LABEL = { en: 'English', ar: 'العربية' } as const;

/** Header language dropdown (desktop). */
export function LanguageSwitcher() {
  const { locale } = useLocale();
  const altHref = useAlternateHref();
  const other = locale === 'en' ? 'ar' : 'en';

  return (
    <TopItem
      label={CURRENT_LABEL[locale]}
      active={false}
      lang={locale}
      renderMenu={(open, close) => (
        // Last menu item: align the panel to the end edge so it never overflows the viewport.
        <DropdownPanel open={open} sx={{ right: 0, minWidth: 240, pt: '18px', pb: '22px', boxShadow: (t) => t.customShadows.submenu }}>
          <Box
            component={Link}
            to={altHref(other)}
            hrefLang={other}
            lang={other}
            onClick={close}
            sx={{ ...subLinkSx, px: '30px', whiteSpace: 'nowrap' }}
          >
            <span className="sub-label">{OPTION_LABEL[other]}</span>
          </Box>
        </DropdownPanel>
      )}
    />
  );
}
