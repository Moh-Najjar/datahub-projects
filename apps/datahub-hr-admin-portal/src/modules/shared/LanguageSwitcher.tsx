import Button from '@mui/material/Button';
import TranslateOutlined from '@mui/icons-material/TranslateOutlined';
import { useTranslation } from 'react-i18next';
import { changeLanguage } from '@/i18n';
import { useLanguage } from '@/i18n/useLanguage';

/** Toggles between English and Arabic; the label is the other language, written in that language. */
export function LanguageSwitcher() {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const other = language === 'en' ? 'ar' : 'en';

  return (
    <Button
      color="inherit"
      size="small"
      startIcon={<TranslateOutlined fontSize="small" />}
      onClick={() => void changeLanguage(other)}
      aria-label={t('actions.switchLanguage', { language: t(`languages.${other}`) })}
      sx={{ minWidth: 0, gap: 0.5 }}
    >
      <span lang={other}>{t(`languages.${other}`)}</span>
    </Button>
  );
}
