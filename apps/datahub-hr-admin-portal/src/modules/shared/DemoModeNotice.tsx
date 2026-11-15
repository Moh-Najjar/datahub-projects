import Alert from '@mui/material/Alert';
import AlertTitle from '@mui/material/AlertTitle';
import Chip from '@mui/material/Chip';
import Tooltip from '@mui/material/Tooltip';
import ScienceOutlined from '@mui/icons-material/ScienceOutlined';
import { useTranslation } from 'react-i18next';

/**
 * The permanent "Demo Mode — Not Real Authentication" warning. `full` on the sign-in page, `compact`
 * (badge with the full text as tooltip) in the app bar. Remove only when real backend auth replaces mock sign-in.
 */
export function DemoModeNotice({ variant }: { variant: 'full' | 'compact' }) {
  const { t } = useTranslation();

  if (variant === 'compact') {
    return (
      <Tooltip title={`${t('demo.title')}. ${t('demo.text')}`}>
        <Chip icon={<ScienceOutlined />} label={t('demo.badge')} color="warning" variant="outlined" size="small" aria-label={t('demo.title')} />
      </Tooltip>
    );
  }

  return (
    <Alert severity="warning" icon={<ScienceOutlined />} role="note">
      <AlertTitle>{t('demo.title')}</AlertTitle>
      {t('demo.text')}
    </Alert>
  );
}
