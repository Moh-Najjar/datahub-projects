import { Fragment } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';
import LockOutlined from '@mui/icons-material/LockOutlined';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { ROLES, type Permission, type Role } from '@/core/config/permissions';
import { Panel } from '@/modules/shared/Panel';
import { usePermissionMatrix } from '@/modules/users/hooks/useUsers';
import { PERMISSION_GROUPS } from '@/modules/users/types/users';
import { permissionLabelKey } from '@/modules/users/utils/labels';
import { QueryBlock } from './QueryBlock';

/**
 * `/users/permissions`: the permission matrix (rows = backend permissions grouped by module, columns = roles), READ-ONLY —
 * roles and their permissions are managed in the backend, and each user's permissions come from their access token.
 * `?role=` highlights one role. Scrolls sideways on small screens with the permission column kept in view.
 */
export function PermissionMatrix() {
  const { t } = useTranslation('users');
  const { t: tc } = useTranslation();
  const [params] = useSearchParams();
  const query = usePermissionMatrix();
  const highlighted = params.get('role') as Role | null;
  const m = query.data;
  const holds = (role: Role, p: Permission) => m?.roles.find((r) => r.role === role)?.permissions.includes(p) ?? false;
  const label = (p: Permission) => tc(permissionLabelKey(p));

  return (
    <Panel title={t('tabs.permissions')} subtitle={t('matrix.intro')}>
      <QueryBlock query={query}>
        {m && (
          <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: 'minmax(0, 1fr)' }}>
            <Alert severity="info">{t('matrix.readOnly')}</Alert>
            <Typography variant="caption" color="text.secondary" sx={{ display: { md: 'none' } }}>
              {t('matrix.scrollHint')}
            </Typography>
            <TableContainer sx={{ overflowX: 'auto', position: 'relative', maxHeight: { md: '70vh' }, border: 1, borderColor: 'divider', borderRadius: 1 }}>
              <Table size="small" stickyHeader aria-label={t('tabs.permissions')} sx={{ minWidth: 980, '& td, & th': { borderColor: 'divider' } }}>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 600, position: 'sticky', left: 0, zIndex: 3, bgcolor: 'background.paper', minWidth: 260 }}>{t('matrix.permission')}</TableCell>
                    {ROLES.map((r) => (
                      <TableCell key={r} align="center" sx={{ fontWeight: 600, minWidth: 96, bgcolor: highlighted === r ? 'action.selected' : 'background.paper' }}>
                        {tc(`roles.${r}`)}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {PERMISSION_GROUPS.map((g) => {
                    const rows = m.permissions.filter((p) => p.group === g);
                    if (!rows.length) return null;
                    return (
                      <Fragment key={g}>
                        <TableRow>
                          <TableCell colSpan={ROLES.length + 1} sx={{ bgcolor: 'action.hover', fontWeight: 700, position: 'sticky', left: 0 }}>
                            {t(`matrix.groups.${g}`)}
                          </TableCell>
                        </TableRow>
                        {rows.map((p) => (
                          <TableRow key={p.permission} hover>
                            <TableCell sx={{ position: 'sticky', left: 0, zIndex: 1, bgcolor: 'background.paper' }}>
                              <Typography variant="body2" sx={{ fontWeight: 500 }}>
                                {label(p.permission)}
                              </Typography>
                              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, alignItems: 'center', mt: 0.25 }}>
                                <Typography variant="caption" color="text.secondary" dir="ltr" component="code">
                                  {p.permission}
                                </Typography>
                                <Chip size="small" variant="outlined" label={t(`matrix.scopes.${p.scope}`)} sx={{ height: 20 }} />
                                {p.sensitive && <Chip size="small" color="warning" variant="outlined" label={t('matrix.sensitive')} title={t('matrix.sensitiveHint')} sx={{ height: 20 }} />}
                              </Box>
                              {p.requiresAnyOf.length > 0 && (
                                <Typography variant="caption" color="text.secondary" component="div">
                                  {t('matrix.requires', { list: p.requiresAnyOf.map(label).join(' / ') })}
                                </Typography>
                              )}
                            </TableCell>
                            {ROLES.map((r) => {
                              const has = holds(r, p.permission);
                              const locked = r === 'system-admin' || p.locked !== null;
                              const why = r === 'system-admin' ? t('matrix.lockedRole') : p.locked === 'self-service' ? t('matrix.lockedSelf') : p.locked === 'system-only' ? t('matrix.lockedSystem') : undefined;
                              return (
                                <TableCell key={r} align="center" sx={{ bgcolor: highlighted === r ? 'action.selected' : undefined }}>
                                  <Box component="span" title={why} aria-label={`${tc(`roles.${r}`)}: ${label(p.permission)} — ${has ? '✓' : '✗'}`} role="img" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.25, color: has ? 'success.main' : 'text.disabled' }}>
                                    {has ? '✓' : '—'}
                                    {locked && has && <LockOutlined sx={{ fontSize: 12 }} aria-hidden />}
                                  </Box>
                                </TableCell>
                              );
                            })}
                          </TableRow>
                        ))}
                      </Fragment>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        )}
      </QueryBlock>
    </Panel>
  );
}
