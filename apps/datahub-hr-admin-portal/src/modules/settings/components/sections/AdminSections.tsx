import { useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import InputAdornment from '@mui/material/InputAdornment';
import MenuItem from '@mui/material/MenuItem';
import Switch from '@mui/material/Switch';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TablePagination from '@mui/material/TablePagination';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import SearchOutlined from '@mui/icons-material/SearchOutlined';
import { Controller } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { isApiError } from '@/core/api/types';
import { formatDate, formatNumber } from '@/i18n/format';
import { useLanguage } from '@/i18n/useLanguage';
import { Feedback } from '@/modules/shared/Feedback';
import { useFeedback } from '@/modules/shared/hooks/useFeedback';
import { Panel } from '@/modules/shared/Panel';
import { useAuditLog, useResetAllSettings, useSecurityStatus } from '@/modules/settings/hooks/useSettings';
import { useValidationText } from '@/modules/settings/hooks/useValidationText';
import { usesLeadDays } from '@/modules/settings/schemas/settingsSchemas';
import { AUDIT_MODULES, RECIPIENT_GROUPS, type AuditModule, type NotificationRule } from '@/modules/settings/types/settings';
import { FactList, QueryState } from '../common/Facts';
import { ReasonDialog } from '@/modules/shared/ReasonDialog';
import { SectionEditor } from '../common/SectionEditor';

/* Notifications ------------------------------------------------------------------------------------------------------ */

export function NotificationsSection({ readOnly }: { readOnly: boolean }) {
  const { t } = useTranslation('settings');
  const message = useValidationText();
  return (
    <Box sx={{ display: 'grid', gap: 2.5, gridTemplateColumns: 'minmax(0, 1fr)' }}>
      <Alert severity="warning">{t('notifications.notice')}</Alert>
      <SectionEditor section="notifications" title={t('categories.notifications.title')} subtitle={t('notifications.intro')} readOnly={readOnly}>
        {(form, disabled) => (
          <>
            <Controller control={form.control} name="inApp" render={({ field }) => <FormControlLabel control={<Switch checked={Boolean(field.value)} disabled={disabled} onChange={(e) => field.onChange(e.target.checked)} />} label={t('notifications.inApp')} />} />
            <Controller
              control={form.control}
              name="rules"
              render={({ field, fieldState }) => {
                const rules = (field.value ?? []) as NotificationRule[];
                const set = (i: number, patch: Partial<NotificationRule>) => field.onChange(rules.map((r, j) => (j === i ? { ...r, ...patch } : r)));
                const errorOf = (i: number, key: 'recipients' | 'leadDays') => {
                  const e = (fieldState.error as unknown as Array<Record<string, { message?: string }>> | undefined)?.[i]?.[key]?.message;
                  return message(e);
                };
                return (
                  <TableContainer sx={{ overflowX: 'auto', position: 'relative' }}>
                    <Table size="small" aria-label={t('categories.notifications.title')} sx={{ minWidth: 760 }}>
                      <TableHead>
                        <TableRow>
                          <TableCell sx={{ fontWeight: 600 }}>{t('notifications.event')}</TableCell>
                          <TableCell sx={{ fontWeight: 600 }}>{t('notifications.enabled')}</TableCell>
                          <TableCell sx={{ fontWeight: 600 }}>{t('notifications.recipients')}</TableCell>
                          <TableCell sx={{ fontWeight: 600 }}>{t('notifications.leadDays')}</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {rules.map((r, i) => (
                          <TableRow key={r.event}>
                            <TableCell sx={{ fontWeight: 500 }}>{t(`notifications.events.${r.event}`)}</TableCell>
                            <TableCell>
                              <Switch checked={r.enabled} disabled={disabled} onChange={(e) => set(i, { enabled: e.target.checked })} slotProps={{ input: { 'aria-label': `${t('notifications.enabled')}: ${t(`notifications.events.${r.event}`)}` } }} />
                            </TableCell>
                            <TableCell>
                              <Box sx={{ display: 'flex', flexWrap: 'wrap', columnGap: 1 }}>
                                {RECIPIENT_GROUPS.map((g) => (
                                  <FormControlLabel
                                    key={g}
                                    control={<Checkbox size="small" checked={r.recipients.includes(g)} disabled={disabled || !r.enabled} onChange={() => set(i, { recipients: r.recipients.includes(g) ? r.recipients.filter((x) => x !== g) : [...r.recipients, g] })} />}
                                    label={<Typography variant="body2">{t(`notifications.groups.${g}`)}</Typography>}
                                    sx={{ mr: 0 }}
                                  />
                                ))}
                              </Box>
                              {errorOf(i, 'recipients') && (
                                <Typography variant="caption" color="error">
                                  {errorOf(i, 'recipients')}
                                </Typography>
                              )}
                            </TableCell>
                            <TableCell sx={{ minWidth: 140 }}>
                              {usesLeadDays(r.event) ? (
                                <TextField
                                  size="small"
                                  type="number"
                                  value={r.leadDays ?? ''}
                                  disabled={disabled || !r.enabled}
                                  onChange={(e) => set(i, { leadDays: e.target.value === '' ? null : Number(e.target.value) })}
                                  error={Boolean(errorOf(i, 'leadDays'))}
                                  helperText={errorOf(i, 'leadDays') ?? t(`notifications.leadHint.${r.event as 'document-expiry'}`)}
                                  slotProps={{ htmlInput: { min: 1, max: 90, dir: 'ltr', 'aria-label': `${t('notifications.leadDays')}: ${t(`notifications.events.${r.event}`)}` } }}
                                />
                              ) : (
                                '—'
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                );
              }}
            />
          </>
        )}
      </SectionEditor>
    </Box>
  );
}

/* Security & session ------------------------------------------------------------------------------------------------- */

export function SecuritySection({ canEdit }: { canEdit: boolean }) {
  const { t } = useTranslation('settings');
  const { language } = useLanguage();
  const message = useValidationText();
  const status = useSecurityStatus();
  return (
    <Box sx={{ display: 'grid', gap: 2.5, gridTemplateColumns: 'minmax(0, 1fr)' }}>
      {!canEdit && <Alert severity="info">{t('security.systemOnly')}</Alert>}
      <SectionEditor section="security" title={t('security.session')} subtitle={t('security.sessionHint')} readOnly={!canEdit} reasonRequired>
        {(form, disabled) => (
          <>
            <Controller
              control={form.control}
              name="sessionHours"
              render={({ field, fieldState }) => (
                <TextField
                  {...field}
                  type="number"
                  label={t('security.sessionHours')}
                  disabled={disabled}
                  onChange={(e) => field.onChange(e.target.value === '' ? Number.NaN : Number(e.target.value))}
                  value={Number.isNaN(field.value) ? '' : field.value}
                  error={Boolean(fieldState.error)}
                  helperText={message(fieldState.error?.message) ?? t('security.sessionHint')}
                  slotProps={{ htmlInput: { min: 1, max: 12, dir: 'ltr' }, input: { endAdornment: <InputAdornment position="end">{t('overview.hours', { value: '' }).trim()}</InputAdornment> } }}
                  sx={{ maxWidth: 320 }}
                />
              )}
            />
            <Controller control={form.control} name="showSessionExpiry" render={({ field }) => <FormControlLabel control={<Switch checked={Boolean(field.value)} disabled={disabled} onChange={(e) => field.onChange(e.target.checked)} />} label={t('security.showExpiry')} />} />
          </>
        )}
      </SectionEditor>
      <Panel title={t('security.sso')} subtitle={t('security.ssoIntro')}>
        <QueryState query={status}>
          {status.data && (
            <FactList
              items={[
                { label: t('security.workspace'), value: status.data.workspaceConfigured ? <bdi dir="ltr">{`${t('security.configured')} · ${status.data.workspaceOrigin}`}</bdi> : t('security.notConfigured') },
                { label: t('security.handoff'), value: t('security.handoffValue', { value: formatNumber(status.data.handoffMaxMinutes, language) }) },
                { label: t('security.storage'), value: t('security.storageValue') },
                { label: t('security.signOut'), value: t('security.signOutValue') },
                { label: t('security.passwords'), value: t('security.passwordsValue') },
              ]}
            />
          )}
        </QueryState>
        <Alert severity="warning" variant="outlined" sx={{ mt: 2 }}>
          {t('security.mockNotice')}
        </Alert>
      </Panel>
    </Box>
  );
}

/* Audit & data ------------------------------------------------------------------------------------------------------- */

export function AuditSection({ canReset }: { canReset: boolean }) {
  const { t } = useTranslation('settings');
  const { t: tc } = useTranslation();
  const { language } = useLanguage();
  const [module, setModule] = useState<'' | AuditModule>('');
  const [from, setFrom] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const query = useAuditLog({ page: page + 1, pageSize, search: search || undefined, filters: { module: module || undefined, from: from || undefined } });
  const resetAll = useResetAllSettings();
  const feedback = useFeedback();
  const [confirming, setConfirming] = useState(false);

  return (
    <Box sx={{ display: 'grid', gap: 2.5, gridTemplateColumns: 'minmax(0, 1fr)' }}>
      <Panel title={t('categories.audit.title')} subtitle={t('audit.intro')}>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, mb: 2 }}>
          <TextField
            size="small"
            type="search"
            label={t('audit.search')}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
            slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchOutlined fontSize="small" /></InputAdornment> } }}
            sx={{ flex: '1 1 220px', maxWidth: { sm: 320 } }}
          />
          <TextField select size="small" label={t('audit.module')} value={module} onChange={(e) => setModule(e.target.value as '' | AuditModule)} sx={{ minWidth: 160 }}>
            <MenuItem value="">{t('audit.allModules')}</MenuItem>
            {AUDIT_MODULES.map((m) => (
              <MenuItem key={m} value={m}>
                {t(`audit.modules.${m}`)}
              </MenuItem>
            ))}
          </TextField>
          <TextField size="small" type="date" label={t('audit.from')} value={from} onChange={(e) => setFrom(e.target.value)} slotProps={{ inputLabel: { shrink: true }, htmlInput: { dir: 'ltr' } }} sx={{ minWidth: 160 }} />
        </Box>
        <QueryState query={query}>
          {query.data && (
            <>
              <TableContainer sx={{ overflowX: 'auto', position: 'relative' }}>
                <Table size="small" aria-label={t('categories.audit.title')} sx={{ minWidth: 900 }}>
                  <TableHead>
                    <TableRow>
                      {(['at', 'module', 'target', 'change', 'previous', 'next', 'actor', 'reason'] as const).map((c) => (
                        <TableCell key={c} sx={{ fontWeight: 600, whiteSpace: 'nowrap' }}>
                          {t(`audit.${c}`)}
                        </TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {query.data.items.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={8}>
                          <Typography color="text.secondary" sx={{ py: 3, textAlign: 'center' }}>
                            {t('audit.empty')}
                          </Typography>
                        </TableCell>
                      </TableRow>
                    )}
                    {query.data.items.map((a) => (
                      <TableRow key={a.id} hover>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatDate(a.at, language, { dateStyle: 'medium', timeStyle: 'short' })}</TableCell>
                        <TableCell>{t(`audit.modules.${a.module}`)}</TableCell>
                        <TableCell>
                          <bdi dir="ltr">{a.target.startsWith('holiday:') || a.module !== 'settings' ? a.targetLabel[language] : a.target}</bdi>
                        </TableCell>
                        <TableCell>{t(`audit.actions.${a.action}`)}</TableCell>
                        <TableCell sx={{ maxWidth: 220, overflowWrap: 'anywhere' }}>{a.previous ?? '—'}</TableCell>
                        <TableCell sx={{ maxWidth: 220, overflowWrap: 'anywhere' }}>{a.next ?? '—'}</TableCell>
                        <TableCell>{a.actor.name[language]}</TableCell>
                        <TableCell sx={{ maxWidth: 240, overflowWrap: 'anywhere' }}>{a.reason || t('audit.noReason')}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
              <TablePagination
                component="div"
                count={query.data.total}
                page={page}
                rowsPerPage={pageSize}
                rowsPerPageOptions={[10, 25, 50, 100]}
                onPageChange={(_, p) => setPage(p)}
                onRowsPerPageChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setPage(0);
                }}
                labelRowsPerPage={tc('list.rowsPerPage')}
                labelDisplayedRows={({ from: a, to: b, count }) => tc('list.displayedRows', { from: formatNumber(a, language), to: formatNumber(b, language), value: formatNumber(count, language) })}
                getItemAriaLabel={(type) => tc(`pagination.${type}`)}
              />
            </>
          )}
        </QueryState>
      </Panel>
      {canReset && (
        <Panel title={t('audit.dataTitle')} subtitle={t('audit.dataIntro')}>
          <Button variant="outlined" color="error" onClick={() => setConfirming(true)}>
            {t('audit.resetAll')}
          </Button>
        </Panel>
      )}
      <ReasonDialog
        open={confirming}
        title={t('audit.resetAllTitle')}
        text={t('audit.resetAllBody')}
        confirmLabel={t('audit.resetAll')}
        reasonRequired
        danger
        pending={resetAll.isPending}
        error={resetAll.isError ? tc(`apiErrors.${isApiError(resetAll.error) ? resetAll.error.code : 'SERVER'}`) : undefined}
        onConfirm={(reason) =>
          resetAll.mutate(reason, {
            onSuccess: () => {
              setConfirming(false);
              feedback.notify(t('audit.resetAllDone'));
            },
          })
        }
        onClose={() => {
          resetAll.reset();
          setConfirming(false);
        }}
      />
      <Feedback message={feedback.message} close={feedback.close} />
    </Box>
  );
}
