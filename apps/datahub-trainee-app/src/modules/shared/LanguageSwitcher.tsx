import { useState, type MouseEvent } from 'react';
import Button from '@mui/material/Button';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import ListItemText from '@mui/material/ListItemText';
import CheckIcon from '@mui/icons-material/Check';
import LanguageIcon from '@mui/icons-material/Language';
import { LOCALES, type Locale } from '@/i18n/languages';
import { useLocale } from '@/i18n/LocaleContext';
import { useT } from '@/i18n/useT';

/** English / العربية switcher. The choice is remembered and applies `lang` and `dir` to the page. */
export function LanguageSwitcher() {
  const t = useT();
  const { locale, setLocale } = useLocale();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);

  const choose = (next: Locale) => {
    setLocale(next);
    setAnchor(null);
  };

  return (
    <>
      <Button color="inherit" size="small" startIcon={<LanguageIcon />} onClick={(e: MouseEvent<HTMLElement>) => setAnchor(e.currentTarget)} aria-haspopup="menu" aria-label={t.shell.language} sx={{ color: 'text.secondary' }}>
        {t.languages[locale]}
      </Button>
      <Menu anchorEl={anchor} open={anchor !== null} onClose={() => setAnchor(null)}>
        {LOCALES.map((code) => (
          <MenuItem key={code} selected={code === locale} onClick={() => choose(code)} lang={code} sx={{ minWidth: 160 }}>
            <ListItemText>{t.languages[code]}</ListItemText>
            {code === locale && <CheckIcon fontSize="small" color="primary" />}
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}
