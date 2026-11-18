import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import SearchOffOutlined from '@mui/icons-material/SearchOffOutlined';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useAuth } from '@/core/context/authContext';
import { landingPath } from '@/core/routes/navigation';

/** 404 for unknown routes (inside the signed-in shell; signed-out users are sent to sign-in first). */
export default function NotFoundPage() {
  const { t } = useTranslation();
  const { canAny } = useAuth();
  return (
    <Box sx={{ minHeight: { xs: 320, md: 420 }, display: 'grid', placeItems: 'center' }}>
      <Box sx={{ width: '100%', maxWidth: 480, px: { xs: 2.5, sm: 4 }, py: { xs: 4, sm: 5 }, textAlign: 'center', border: 1, borderColor: 'divider', borderRadius: 1, bgcolor: 'background.paper' }}>
        <Box aria-hidden="true" sx={{ width: 48, height: 48, mx: 'auto', mb: 2, display: 'grid', placeItems: 'center', borderRadius: '50%', bgcolor: 'action.hover', color: 'text.secondary' }}>
          <SearchOffOutlined />
        </Box>
        <Typography variant="h3" component="h1" sx={{ mb: 1 }}>
          {t('errors.notFoundTitle')}
        </Typography>
        <Typography color="text.secondary" sx={{ mb: 3 }}>
          {t('errors.notFoundText')}
        </Typography>
        <Button variant="contained" component={Link} to={landingPath(canAny)}>
          {t('actions.backHome')}
        </Button>
      </Box>
    </Box>
  );
}
