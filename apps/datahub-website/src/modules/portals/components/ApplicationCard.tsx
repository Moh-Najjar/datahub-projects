import type { ReactNode } from 'react';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardActionArea from '@mui/material/CardActionArea';
import Typography from '@mui/material/Typography';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import BadgeOutlinedIcon from '@mui/icons-material/BadgeOutlined';
import EditNoteOutlinedIcon from '@mui/icons-material/EditNoteOutlined';
import type { SvgIconComponent } from '@mui/icons-material';
import { WORKSPACE_ROUTES } from '@/core/routes/paths';
import { UI } from '@/i18n';
import { useLocale } from '@/i18n/LocaleContext';
import { SmartLink } from '@/modules/shared/SmartLink';
import type { ApplicationId } from '@/modules/portals/data/applications';

const ICONS: Record<ApplicationId, SvgIconComponent> = { 'hr-admin': BadgeOutlinedIcon, 'blogs-admin': EditNoteOutlinedIcon };

/**
 * One application of the launcher — a link (same tab, static text only) to `/workspace/open/<app>/`, which opens the
 * application as the signed-in user (Blogs Admin on this site, HR Admin through a fresh handoff token).
 */
export function ApplicationCard({ app }: { app: ApplicationId }) {
  const { locale } = useLocale();
  const t = UI[locale].workspace;
  const Icon = ICONS[app];
  const body: ReactNode = (
    <>
      <Box sx={{ width: 56, height: 56, borderRadius: '8px', display: 'grid', placeItems: 'center', background: 'linear-gradient(135deg, #36a829, #00469b)', color: 'common.white' }}>
        <Icon aria-hidden />
      </Box>
      <Box sx={{ flex: 1 }}>
        <Typography component="h2" sx={{ fontSize: 20, fontWeight: 500, color: 'brand.heading' }}>
          {t.apps[app].name}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: '6px', fontSize: 14, lineHeight: 1.6 }}>
          {t.apps[app].description}
        </Typography>
      </Box>
      <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'primary.main', fontWeight: 500, fontSize: 15 }}>
        {t.home.open}
        <ArrowForwardIcon aria-hidden sx={{ fontSize: 18, transform: locale === 'ar' ? 'scaleX(-1)' : undefined }} />
      </Box>
    </>
  );
  const areaSx = { height: '100%', p: '24px', display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: '16px' } as const;

  const area = (
    <CardActionArea component={SmartLink} href={WORKSPACE_ROUTES.open(app)} sx={areaSx}>
      {body}
    </CardActionArea>
  );

  return (
    <Card variant="outlined" sx={{ height: '100%', borderRadius: '8px', transition: 'border-color .2s, box-shadow .2s', '&:hover': { borderColor: 'primary.main', boxShadow: (theme) => theme.customShadows.card } }}>
      {area}
    </Card>
  );
}
