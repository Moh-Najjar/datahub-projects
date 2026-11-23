import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink } from 'react-router-dom';
import { formatNumber } from '@/i18n/format';
import { useLanguage } from '@/i18n/useLanguage';
import { Panel } from '@/modules/shared/Panel';
import { useRoles } from '@/modules/users/hooks/useUsers';
import { usersPaths } from '@/modules/users/paths';
import { QueryBlock } from './QueryBlock';

/** `/users/roles`: the seven system roles with their accounts and permission counts. */
export function RolesSection() {
  const { t } = useTranslation('users');
  const { t: tc } = useTranslation();
  const { language } = useLanguage();
  const query = useRoles();
  const n = (v: number) => formatNumber(v, language);
  return (
    <Panel title={t('tabs.roles')} subtitle={t('roles.intro')}>
      <QueryBlock query={query}>
        <TableContainer sx={{ overflowX: 'auto', position: 'relative' }}>
          <Table size="small" aria-label={t('tabs.roles')} sx={{ minWidth: 860 }}>
            <TableHead>
              <TableRow>
                {(['role', 'description', 'users', 'permissions', 'type'] as const).map((c) => (
                  <TableCell key={c} sx={{ fontWeight: 600, whiteSpace: 'nowrap' }}>
                    {t(`roles.${c}`)}
                  </TableCell>
                ))}
                <TableCell />
              </TableRow>
            </TableHead>
            <TableBody>
              {(query.data ?? []).map((r) => (
                <TableRow key={r.role} hover>
                  <TableCell sx={{ fontWeight: 600, whiteSpace: 'nowrap' }}>
                    {tc(`roles.${r.role}`)}
                    <Box component="div" dir="ltr" sx={{ color: 'text.secondary', fontWeight: 400, typography: 'caption' }}>
                      {r.role}
                    </Box>
                  </TableCell>
                  <TableCell sx={{ minWidth: 260 }}>{t(`roles.descriptions.${r.role}`)}</TableCell>
                  <TableCell>{t('roles.activeOf', { active: n(r.activeUsers), total: n(r.users) })}</TableCell>
                  <TableCell>{n(r.permissions)}</TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      <Chip size="small" variant="outlined" label={t('roles.system')} />
                      {r.locked && <Chip size="small" variant="outlined" color="primary" label={t('roles.locked')} />}
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Button size="small" component={RouterLink} to={`${usersPaths.permissions}?role=${r.role}`}>
                      {t('roles.viewPermissions')}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </QueryBlock>
    </Panel>
  );
}
