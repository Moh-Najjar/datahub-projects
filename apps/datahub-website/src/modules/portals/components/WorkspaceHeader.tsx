import AppBar from '@mui/material/AppBar';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import LogoutOutlinedIcon from '@mui/icons-material/LogoutOutlined';
import { ROUTES, WORKSPACE_ROUTES } from '@/core/routes/paths';
import { UI } from '@/i18n';
import { useLocale } from '@/i18n/LocaleContext';
import { SmartLink } from '@/modules/shared/SmartLink';
import type { WorkspaceSession } from '@/modules/portals/api/workspaceAuth';
import { LanguageLink } from './LanguageLink';

/** Workspace bar: DataHub logo + Workspace label, website link, language, signed-in user and role, sign out. */
export function WorkspaceHeader({ session }: { session: WorkspaceSession }) {
  const { locale } = useLocale();
  const t = UI[locale].workspace;
  return (
    <AppBar position="sticky" color="inherit" elevation={0} sx={{ borderBottom: '1px solid #ededed', bgcolor: 'common.white' }}>
      <Toolbar sx={{ gap: { xs: 1, sm: 2 }, minHeight: { xs: 60 }, px: { xs: '15px', md: '30px' } }}>
        <Box component={SmartLink} href={WORKSPACE_ROUTES.root} sx={{ display: 'flex', alignItems: 'center', gap: '12px', mr: 'auto', minWidth: 0 }} aria-label={t.name}>
          <Box component="img" src="/assets/logos/datahub-logo.png" srcSet="/assets/logos/datahub-logo.png 1x, /assets/logos/datahub-logo@2x.png 2x" alt="Datahub Analytics" width={250} height={46} sx={{ width: { xs: 120, sm: 160 }, height: 'auto' }} />
          <Typography component="span" sx={{ display: { xs: 'none', sm: 'inline' }, px: '8px', py: '2px', borderRadius: '4px', bgcolor: 'brand.heading', color: 'common.white', fontSize: 12, fontWeight: 500, letterSpacing: locale === 'en' ? '1px' : 0, textTransform: 'uppercase' }}>
            {t.name}
          </Typography>
        </Box>
        <Button component={SmartLink} href={ROUTES.home} color="inherit" sx={{ display: { xs: 'none', md: 'inline-flex' }, height: 40, px: 2 }}>
          {t.header.viewSite}
        </Button>
        <Box sx={{ display: { xs: 'none', md: 'block' } }}>
          <LanguageLink />
        </Box>
        <Box sx={{ display: { xs: 'none', sm: 'block' }, textAlign: 'end', lineHeight: 1.3, minWidth: 0 }}>
          <Typography variant="body2" noWrap sx={{ fontWeight: 500, color: 'brand.heading' }}>
            {session.name[locale]}
          </Typography>
          <Typography variant="caption" color="text.secondary" noWrap component="p">
            {t.roles[session.role]}
          </Typography>
        </Box>
        <Button
          component={SmartLink}
          href={WORKSPACE_ROUTES.logout}
          variant="outlined"
          startIcon={<LogoutOutlinedIcon sx={{ transform: locale === 'ar' ? 'scaleX(-1)' : undefined }} />}
          sx={{ height: 40, px: 2, flexShrink: 0 }}
        >
          {t.header.signOut}
        </Button>
      </Toolbar>
    </AppBar>
  );
}
