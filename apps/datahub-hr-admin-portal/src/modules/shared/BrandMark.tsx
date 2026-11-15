import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { useTranslation } from 'react-i18next';

/** Typographic DataHub HR Admin mark (no logo artwork exists yet). */
export function BrandMark() {
  const { t } = useTranslation();
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
      <Box
        aria-hidden="true"
        dir="ltr"
        sx={{
          width: 36,
          height: 36,
          flexShrink: 0,
          display: 'grid',
          placeItems: 'center',
          borderRadius: 1,
          bgcolor: 'primary.main',
          color: 'primary.contrastText',
          fontWeight: 700,
          fontSize: 14,
          letterSpacing: '0.02em',
        }}
      >
        HR
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography component="span" sx={{ display: 'block', fontWeight: 700, lineHeight: 1.2 }} noWrap>
          DataHub HR
        </Typography>
        <Typography component="span" variant="caption" color="text.secondary" sx={{ display: 'block', lineHeight: 1.2 }} noWrap>
          {t('appShortName')}
        </Typography>
      </Box>
    </Box>
  );
}
