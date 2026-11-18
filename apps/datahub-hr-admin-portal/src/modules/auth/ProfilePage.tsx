import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import { useTranslation } from 'react-i18next';
import { ROLE_PERMISSIONS, type Permission } from '@/core/config/permissions';
import { useAuth } from '@/core/context/authContext';
import type enCommon from '@/i18n/locales/en/common.json';
import { useLanguage } from '@/i18n/useLanguage';
import { accountInitials } from '@/modules/shared/accountInitials';
import { PageHeader } from '@/modules/shared/PageHeader';

/** `leave:approve:team` → `permissions.leave_approve_team` (":" is i18next's namespace separator). */
const permissionLabelKey = (p: Permission) => `permissions.${p.replaceAll(':', '_') as keyof typeof enCommon.permissions}` as const;

/** The signed-in user's account details and the permissions their role grants. */
export default function ProfilePage() {
  const { t } = useTranslation('auth');
  const { t: tc } = useTranslation();
  const { language } = useLanguage();
  const { user } = useAuth();
  if (!user) return null; // Route is behind RequireAuth.

  const name = user.name[language];
  const rows: Array<{ label: string; value: string; ltr?: boolean }> = [
    { label: t('profile.name'), value: name },
    { label: t('profile.email'), value: user.email, ltr: true },
    { label: t('profile.role'), value: tc(`roles.${user.role}`) },
    ...(user.department ? [{ label: t('profile.department'), value: user.department[language] }] : []),
  ];

  return (
    <>
      <PageHeader title={t('profile.title')} subtitle={t('profile.subtitle')} />
      <Paper variant="outlined" sx={{ p: { xs: 2.5, sm: 3 }, mb: 2.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2.5, pb: 2.5, borderBottom: 1, borderColor: 'divider' }}>
          <Avatar sx={{ width: 56, height: 56, fontSize: 18, fontWeight: 700, bgcolor: 'primary.main', color: 'primary.contrastText' }}>{accountInitials(name)}</Avatar>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="h5" component="p" sx={{ overflowWrap: 'anywhere' }}>
              {name}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {tc(`roles.${user.role}`)}
            </Typography>
          </Box>
        </Box>
        <Box component="dl" sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '180px 1fr' }, columnGap: 3, rowGap: 1.75, m: 0 }}>
          {rows.map(({ label, value, ltr }) => (
            <Box key={label} sx={{ display: 'contents' }}>
              <Typography component="dt" variant="body2" color="text.secondary">
                {label}
              </Typography>
              <Typography component="dd" dir={ltr ? 'ltr' : undefined} sx={{ m: 0, fontWeight: 600, textAlign: 'start', overflowWrap: 'anywhere' }}>
                {value}
              </Typography>
            </Box>
          ))}
        </Box>
      </Paper>
      <Paper variant="outlined" sx={{ p: { xs: 2.5, sm: 3 } }}>
        <Typography variant="h6" component="h2">
          {t('profile.permissionsTitle')}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, mb: 2, pb: 1.5, borderBottom: 1, borderColor: 'divider' }}>
          {t('profile.permissionsHint')}
        </Typography>
        <Box component="ul" aria-label={t('profile.permissionsTitle')} sx={{ listStyle: 'none', m: 0, p: 0, display: 'flex', flexWrap: 'wrap', gap: 1 }}>
          {ROLE_PERMISSIONS[user.role].map((permission) => (
            <li key={permission}>
              <Chip label={tc(permissionLabelKey(permission))} variant="outlined" size="small" />
            </li>
          ))}
        </Box>
      </Paper>
    </>
  );
}
