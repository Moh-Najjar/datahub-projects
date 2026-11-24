import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { useT } from '@/i18n/useT';

/** Typographic DataHub Training mark (a monogram — no artwork is invented). `compact` keeps just the monogram. */
export function BrandMark({ compact = false, inverse = false }: { compact?: boolean; inverse?: boolean }) {
  const t = useT();
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
          bgcolor: inverse ? 'common.white' : 'primary.main',
          color: inverse ? 'primary.main' : 'primary.contrastText',
          fontWeight: 700,
          fontSize: 13,
          letterSpacing: '0.04em',
        }}
      >
        DH
      </Box>
      {!compact && (
        <Box sx={{ minWidth: 0 }}>
          <Typography component="span" sx={{ display: 'block', fontWeight: 700, lineHeight: 1.15, letterSpacing: '-0.01em', color: inverse ? 'common.white' : 'text.primary' }} noWrap>
            {t.app.name}
          </Typography>
          <Typography component="span" variant="caption" sx={{ display: 'block', lineHeight: 1.3, color: inverse ? 'rgba(255,255,255,0.75)' : 'text.secondary' }} noWrap>
            {t.app.byline}
          </Typography>
        </Box>
      )}
    </Box>
  );
}
