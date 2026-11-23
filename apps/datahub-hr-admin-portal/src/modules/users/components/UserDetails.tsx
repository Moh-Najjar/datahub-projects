import { useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Link from '@mui/material/Link';
import MenuItem from '@mui/material/MenuItem';
import Skeleton from '@mui/material/Skeleton';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink, useLocation, useParams } from 'react-router-dom';
import { isApiError } from '@/core/api/types';
import { ROLES, type Role } from '@/core/config/permissions';
import { useBreadcrumbs } from '@/core/context/breadcrumbContext';
import { formatDate } from '@/i18n/format';
import { useLanguage } from '@/i18n/useLanguage';
import { useAuditLog } from '@/modules/settings';
import { Feedback } from '@/modules/shared/Feedback';
import { useFeedback } from '@/modules/shared/hooks/useFeedback';
import { DetailList, Panel } from '@/modules/shared/Panel';
import { ReasonDialog } from '@/modules/shared/ReasonDialog';
import { useLinkEmployee, useUser, useUserRole, useUserStatus } from '@/modules/users/hooks/useUsers';
import type { EmployeeChoice } from '@/modules/users/hooks/useEmployeeSearch';
import { usersPaths } from '@/modules/users/paths';
import type { AccountStatus, UserDetails as Details } from '@/modules/users/types/users';
import { permissionLabelKey } from '@/modules/users/utils/labels';
import { PERMISSION_INFO } from '@/modules/users/utils/permissionRules';
import { STATUS_COLOR } from '@/modules/users/utils/status';
import { EmployeePicker } from './EmployeePicker';
import { UserFormDialog } from './UserFormDialog';

type Action = { kind: 'role' } | { kind: 'status'; status: AccountStatus } | { kind: 'link' } | { kind: 'unlink' } | null;

/** `/users/accounts/:userId`: one account, its employee link, permissions, sign-in information and history. */
export function UserDetails() {
  const { userId = '' } = useParams();
  const { t } = useTranslation('users');
  const { t: tc } = useTranslation();
  const { language } = useLanguage();
  const location = useLocation();
  const query = useUser(userId);
  const u = query.data;
  useBreadcrumbs(u ? [{ label: u.name[language] }] : []);
  const feedback = useFeedback();
  const [created, setCreated] = useState<string | null>(() => (location.state as { created?: string } | null)?.created ?? null);

  if (query.isPending) return <Skeleton variant="rounded" height={320} />;
  if (query.isError || !u)
    return (
      <Alert
        severity={isApiError(query.error) && query.error.code === 'NOT_FOUND' ? 'warning' : 'error'}
        action={
          <Button color="inherit" size="small" onClick={() => void query.refetch()}>
            {tc('actions.retry')}
          </Button>
        }
      >
        {isApiError(query.error) && query.error.code === 'NOT_FOUND' ? tc('apiErrors.NOT_FOUND') : tc('apiErrors.SERVER')}
      </Alert>
    );
  return (
    <>
      {created && (
        <Alert severity="success" onClose={() => setCreated(null)} sx={{ mb: 2 }}>
          {t('messages.created', { name: created })}
        </Alert>
      )}
      <AccountView key={u.id} user={u} notify={feedback.notify} />
      <Feedback message={feedback.message} close={feedback.close} />
    </>
  );
}

function AccountView({ user: u, notify }: { user: Details; notify: (text: string, severity?: 'success' | 'error') => void }) {
  const { t } = useTranslation('users');
  const { t: ts } = useTranslation('settings');
  const { t: tc } = useTranslation();
  const { language } = useLanguage();
  const role = useUserRole(u.id);
  const status = useUserStatus(u.id);
  const link = useLinkEmployee(u.id);
  const history = useAuditLog({ page: 1, pageSize: 50, filters: { target: `user:${u.id}` } });
  const [action, setAction] = useState<Action>(null);
  const [editing, setEditing] = useState(false);
  const [newRole, setNewRole] = useState<Role>(u.role);
  const [employee, setEmployee] = useState<EmployeeChoice | null>(null);
  const date = (iso: string) => formatDate(iso, language, { dateStyle: 'medium', timeStyle: 'short' });
  const apiText = (error: unknown) => {
    if (isApiError(error) && error.code === 'VALIDATION' && error.fieldErrors) {
      const reason = Object.values(error.fieldErrors)[0]?.[0];
      return reason ? (t(`validation.${reason}` as never, { defaultValue: t('validation.invalid') }) as string) : undefined;
    }
    return isApiError(error) ? tc(`apiErrors.${error.code}`) : tc('apiErrors.SERVER');
  };
  const grouped = PERMISSION_INFO.filter((p) => u.permissions.includes(p.permission));
  const groups = [...new Set(grouped.map((p) => p.group))];
  const close = () => {
    role.reset();
    status.reset();
    link.reset();
    setAction(null);
  };

  const dialog = (() => {
    if (!action) return null;
    if (action.kind === 'role')
      return {
        title: t('dialogs.roleTitle', { name: u.name[language] }),
        text: (
          <Box sx={{ display: 'grid', gap: 2 }}>
            <span>{t('dialogs.roleBody')}</span>
            <TextField select label={t('dialogs.newRole')} value={newRole} onChange={(e) => setNewRole(e.target.value as Role)} sx={{ mt: 1 }}>
              {ROLES.map((r) => (
                <MenuItem key={r} value={r}>
                  {tc(`roles.${r}`)}
                </MenuItem>
              ))}
            </TextField>
          </Box>
        ),
        label: t('details.changeRole'),
        danger: false,
        pending: role.isPending,
        error: role.isError ? apiText(role.error) : undefined,
        run: (reason: string) => role.mutate({ role: newRole, reason }, { onSuccess: () => (close(), notify(t('messages.roleChanged'))) }),
      };
    if (action.kind === 'status') {
      const key = action.status === 'active' ? 'activate' : action.status === 'inactive' ? 'deactivate' : 'suspend';
      return {
        title: t(`dialogs.${key}Title`, { name: u.name[language] }),
        text: t(`dialogs.${key}Body`),
        label: t(`details.${key}`),
        danger: action.status !== 'active',
        pending: status.isPending,
        error: status.isError ? apiText(status.error) : undefined,
        run: (reason: string) => status.mutate({ status: action.status, reason }, { onSuccess: () => (close(), notify(t('messages.statusChanged'))) }),
      };
    }
    if (action.kind === 'link')
      return {
        title: t('dialogs.linkTitle', { name: u.name[language] }),
        text: (
          <Box sx={{ display: 'grid', gap: 2 }}>
            <span>{t('dialogs.linkBody')}</span>
            <EmployeePicker value={employee} onChange={setEmployee} />
          </Box>
        ),
        label: t('details.link'),
        danger: false,
        pending: link.isPending,
        error: link.isError ? apiText(link.error) : undefined,
        run: (reason: string) => employee && link.mutate({ employeeId: employee.id, reason }, { onSuccess: () => (close(), notify(t('messages.linked'))) }),
      };
    return {
      title: t('dialogs.unlinkTitle', { name: u.name[language], employee: u.employee?.name[language] ?? '' }),
      text: t('dialogs.unlinkBody'),
      label: t('details.unlink'),
      danger: true,
      pending: link.isPending,
      error: link.isError ? apiText(link.error) : undefined,
      run: (reason: string) => link.mutate({ employeeId: null, reason }, { onSuccess: () => (close(), notify(t('messages.unlinked'))) }),
    };
  })();

  return (
    <Box sx={{ display: 'grid', gap: 2.5, gridTemplateColumns: 'minmax(0, 1fr)' }}>
      <Box>
        <Button component={RouterLink} to={usersPaths.users}>
          {t('details.back')}
        </Button>
      </Box>
      {u.can.reason && <Alert severity="info">{t(`details.protected.${u.can.reason}`)}</Alert>}
      <Panel
        title={u.name[language]}
        subtitle={<bdi dir="ltr">{u.email}</bdi>}
        actions={
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }} role="group" aria-label={t('details.actions')}>
            <Button variant="outlined" onClick={() => setEditing(true)}>
              {t('details.edit')}
            </Button>
            {u.can.changeRole && (
              <Button
                variant="outlined"
                onClick={() => {
                  setNewRole(u.role);
                  setAction({ kind: 'role' });
                }}
              >
                {t('details.changeRole')}
              </Button>
            )}
            {u.can.changeStatus && u.status !== 'active' && (
              <Button variant="outlined" onClick={() => setAction({ kind: 'status', status: 'active' })}>
                {t('details.activate')}
              </Button>
            )}
            {u.can.changeStatus && u.status === 'active' && (
              <>
                <Button variant="outlined" color="warning" onClick={() => setAction({ kind: 'status', status: 'suspended' })}>
                  {t('details.suspend')}
                </Button>
                <Button variant="outlined" color="error" onClick={() => setAction({ kind: 'status', status: 'inactive' })}>
                  {t('details.deactivate')}
                </Button>
              </>
            )}
          </Box>
        }
      >
        <DetailList
          items={[
            { label: t('directory.role'), value: tc(`roles.${u.role}`) },
            { label: t('directory.status'), value: <Chip size="small" variant="outlined" color={STATUS_COLOR[u.status]} label={t(`statuses.${u.status}`)} /> },
            { label: t('details.origin'), value: t(`origin.${u.origin}`) },
            { label: t('details.lastLogin'), value: u.lastLoginAt ? date(u.lastLoginAt) : `${t('directory.neverSignedIn')} — ${t('details.lastLoginHint')}` },
            { label: t('details.created'), value: date(u.createdAt) },
            { label: t('details.updated'), value: date(u.updatedAt) },
          ]}
        />
      </Panel>
      <Panel
        title={t('details.employee')}
        actions={
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            <Button
              variant="outlined"
              onClick={() => {
                setEmployee(null);
                setAction({ kind: 'link' });
              }}
            >
              {u.employee ? t('details.changeLink') : t('details.link')}
            </Button>
            {u.employee && (
              <Button variant="outlined" color="error" onClick={() => setAction({ kind: 'unlink' })}>
                {t('details.unlink')}
              </Button>
            )}
          </Box>
        }
      >
        {u.employee ? (
          <DetailList
            items={[
              { label: t('directory.employee'), value: <Link component={RouterLink} to={`/employees/${u.employee.id}`}>{`${u.employee.name[language]} · ${u.employee.employeeNumber}`}</Link> },
              { label: t('directory.department'), value: u.employee.department.name[language] },
            ]}
          />
        ) : (
          <Typography color="text.secondary">{t('details.noEmployee')}</Typography>
        )}
      </Panel>
      <Panel title={t('details.permissions')} subtitle={t('details.permissionsHint', { role: tc(`roles.${u.role}`) })}>
        <Box sx={{ display: 'grid', gap: 1.5 }}>
          {groups.map((g) => (
            <Box key={g}>
              <Typography variant="subtitle2" component="h3">
                {t(`matrix.groups.${g}`)}
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mt: 0.5 }}>
                {grouped
                  .filter((p) => p.group === g)
                  .map((p) => (
                    <Chip key={p.permission} size="small" variant="outlined" color={p.sensitive ? 'warning' : 'default'} label={tc(permissionLabelKey(p.permission))} title={p.permission} />
                  ))}
              </Box>
            </Box>
          ))}
        </Box>
      </Panel>
      <Panel title={t('details.history')}>
        {(history.data?.items ?? []).length === 0 ? (
          <Typography color="text.secondary">{t('details.noHistory')}</Typography>
        ) : (
          <Box component="ul" sx={{ m: 0, pl: 2.5, display: 'grid', gap: 1 }}>
            {history.data!.items.map((a) => (
              <Typography key={a.id} component="li" variant="body2">
                <strong>{ts(`audit.actions.${a.action}`)}</strong>
                {` · ${date(a.at)} · ${a.actor.name[language]} · ${a.previous ?? '—'} → ${a.next ?? '—'}${a.reason ? ` · ${a.reason}` : ''}`}
              </Typography>
            ))}
          </Box>
        )}
      </Panel>
      {editing && (
        <UserFormDialog
          user={u}
          onClose={() => setEditing(false)}
          onDone={() => {
            setEditing(false);
            notify(t('messages.updated'));
          }}
        />
      )}
      {dialog && (
        <ReasonDialog
          open
          title={dialog.title}
          text={dialog.text}
          confirmLabel={dialog.label}
          reasonRequired={action?.kind !== 'link' && !(action?.kind === 'status' && action.status === 'active')}
          danger={dialog.danger}
          pending={dialog.pending}
          error={dialog.error}
          onConfirm={dialog.run}
          onClose={close}
        />
      )}
    </Box>
  );
}
