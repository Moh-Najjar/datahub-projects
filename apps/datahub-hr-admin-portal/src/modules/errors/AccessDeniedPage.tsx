import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import LockOutlined from '@mui/icons-material/LockOutlined';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useAuth } from '@/core/context/authContext';
import { landingPath } from '@/core/routes/navigation';

/** Shown in place of a page the signed-in role may not open (URL unchanged). */
export default function AccessDeniedPage() {
  const { t } = useTranslation();
  const { canAny } = useAuth();
  return (
    <Box role="alert" sx={{ py: { xs: 6, md: 10 }, textAlign: 'center' }}>
      <LockOutlined color="disabled" sx={{ fontSize: 48, mb: 2 }} />
      <Typography variant="h2" component="h1" sx={{ mb: 1 }}>
        {t('errors.accessDeniedTitle')}
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 3, maxWidth: 480, mx: 'auto' }}>
        {t('errors.accessDeniedText')}
      </Typography>
      <Button variant="contained" component={Link} to={landingPath(canAny)}>
        {t('actions.backHome')}
      </Button>
    </Box>
  );
}
