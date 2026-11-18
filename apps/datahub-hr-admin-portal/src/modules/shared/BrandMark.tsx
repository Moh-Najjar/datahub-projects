import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { useTranslation } from 'react-i18next';

/** Typographic DataHub HR mark. `compact` keeps the monogram for a collapsed sidebar. */
export function BrandMark({ compact = false }: { compact?: boolean }) {
  const { t } = useTranslation();
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, minWidth: 0 }}>
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
          fontSize: 13,
          letterSpacing: '0.04em',
        }}
      >
        HR
      </Box>
      {!compact && (
        <Box sx={{ minWidth: 0 }}>
          <Typography component="span" sx={{ display: 'block', fontWeight: 700, lineHeight: 1.15, letterSpacing: '-0.01em' }} noWrap>
            DataHub HR
          </Typography>
          <Typography component="span" variant="caption" color="text.secondary" sx={{ display: 'block', lineHeight: 1.3 }} noWrap>
            {t('appShortName')}
          </Typography>
        </Box>
      )}
    </Box>
  );
}
