import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useAuth } from '@/core/context/authContext';
import { landingPath } from '@/core/routes/navigation';

/** 404 for unknown routes (inside the signed-in shell; signed-out users are sent to sign-in first). */
export default function NotFoundPage() {
  const { t } = useTranslation();
  const { canAny } = useAuth();
  return (
    <Box sx={{ py: { xs: 6, md: 10 }, textAlign: 'center' }}>
      <Typography variant="h2" component="h1" sx={{ mb: 1 }}>
        {t('errors.notFoundTitle')}
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }}>
        {t('errors.notFoundText')}
      </Typography>
      <Button variant="contained" component={Link} to={landingPath(canAny)}>
        {t('actions.backHome')}
      </Button>
    </Box>
  );
}
