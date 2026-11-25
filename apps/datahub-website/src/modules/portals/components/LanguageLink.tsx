import Button from '@mui/material/Button';
import TranslateIcon from '@mui/icons-material/Translate';
import { Link as RouterLink, useLocation } from 'react-router-dom';
import { UI } from '@/i18n';
import { useLocale } from '@/i18n/LocaleContext';
import { localizePath, stripLocale } from '@/i18n/paths';

/** Switches the Workspace page to the other language (same page and query string — e.g. an activation token — other URL prefix). */
export function LanguageLink() {
  const { locale } = useLocale();
  const { pathname, search } = useLocation();
  const other = locale === 'en' ? 'ar' : 'en';
  return (
    <Button
      component={RouterLink}
      to={{ pathname: localizePath(stripLocale(pathname), other), search }}
      replace
      color="inherit"
      startIcon={<TranslateIcon />}
      lang={other}
      sx={{ height: 40, px: 2, flexShrink: 0 }}
    >
      {UI[locale].workspace.switchLanguage}
    </Button>
  );
}
