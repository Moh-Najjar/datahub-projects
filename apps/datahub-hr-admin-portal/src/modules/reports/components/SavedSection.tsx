import { useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Skeleton from '@mui/material/Skeleton';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink } from 'react-router-dom';
import { isApiError } from '@/core/api/types';
import { useLanguage } from '@/i18n/useLanguage';
import { ConfirmDialog } from '@/modules/shared/ConfirmDialog';
import { Panel } from '@/modules/shared/Panel';
import { visuallyHidden } from '@/modules/shared/styles';
import { reportPaths } from '@/modules/reports/paths';
import { useReportCatalog } from '@/modules/reports/hooks/useReportCatalog';
import { useDeleteSavedReport, useSavedReports } from '@/modules/reports/hooks/useReports';
import type { ReportId, SavedReport } from '@/modules/reports/types/reports';
import { formatTime } from '@/modules/reports/utils/format';
import { useReportTitle } from '@/modules/reports/hooks/useReportLabels';
import { SaveReportDialog } from './saved/SaveReportDialog';

/**
 * `/reports/saved`: the user's own saved report configurations. Opening one runs the report again with the current
 * data (results are never stored). A configuration for a report the user can no longer run is shown as unavailable.
 */
export function SavedSection() {
  const { t } = useTranslation('reports');
  const { t: tc } = useTranslation();
  const { language } = useLanguage();
  const catalog = useReportCatalog();
  const titleOf = useReportTitle();
  const query = useSavedReports();
  const remove = useDeleteSavedReport();
  const [renaming, setRenaming] = useState<SavedReport | null>(null);
  const [deleting, setDeleting] = useState<SavedReport | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const reportOf = (s: SavedReport): ReportId | null => (s.kind === 'report' ? s.reportId : (s.builder?.dataset ?? null));
  const linkOf = (s: SavedReport) => (s.kind === 'report' && s.reportId ? reportPaths.report(s.reportId, s.filters, s.id) : reportPaths.builder(s.id));

  let body;
  if (query.isPending) body = <Skeleton variant="rounded" height={160} />;
  else if (query.isError)
    body = (
      <Alert
        severity="error"
        action={
          <Button color="inherit" size="small" onClick={() => void query.refetch()}>
            {tc('actions.retry')}
          </Button>
        }
      >
        {tc('list.loadError')}
      </Alert>
    );
  else if (!query.data.length) body = <Typography color="text.secondary">{t('saved.empty')}</Typography>;
  else
    body = (
      <TableContainer sx={{ overflowX: 'auto' }}>
        <Table size="small" aria-label={t('tabs.saved')}>
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 600 }}>{t('saved.name')}</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>{t('saved.report')}</TableCell>
              <TableCell sx={{ fontWeight: 600, display: { xs: 'none', md: 'table-cell' } }}>{t('saved.updated')}</TableCell>
              <TableCell sx={{ fontWeight: 600 }} align="right">
                <Box component="span" sx={visuallyHidden}>
                  {tc('list.actions')}
                </Box>
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {query.data.map((s) => {
              const id = reportOf(s);
              const available = id !== null && catalog.canRun(id);
              return (
                <TableRow key={s.id} hover>
                  <TableCell sx={{ fontWeight: 600, overflowWrap: 'anywhere' }}>{s.name}</TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, alignItems: 'center' }}>
                      {id ? titleOf(id).title : '—'}
                      <Chip size="small" variant="outlined" label={t(`saved.kinds.${s.kind}`)} />
                      {!available && <Chip size="small" color="warning" label={t('saved.noAccess')} />}
                    </Box>
                  </TableCell>
                  <TableCell sx={{ display: { xs: 'none', md: 'table-cell' }, whiteSpace: 'nowrap' }}>{formatTime(s.updatedAt, language)}</TableCell>
                  <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                    <Button size="small" component={RouterLink} to={linkOf(s)} disabled={!available} aria-label={`${t('actions.run')}: ${s.name}`}>
                      {t('actions.run')}
                    </Button>
                    <Button size="small" onClick={() => setRenaming(s)} aria-label={`${t('actions.rename')}: ${s.name}`}>
                      {t('actions.rename')}
                    </Button>
                    <Button size="small" color="error" onClick={() => setDeleting(s)} aria-label={`${t('actions.delete')}: ${s.name}`}>
                      {t('actions.delete')}
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
    );

  return (
    <Box sx={{ display: 'grid', gap: 2.5, minWidth: 0, gridTemplateColumns: 'minmax(0, 1fr)' }}>
      <Alert severity="info">{t('saved.intro')}</Alert>
      {message && (
        <Alert severity="success" role="status" onClose={() => setMessage(null)}>
          {message}
        </Alert>
      )}
      <Panel title={t('tabs.saved')}>{body}</Panel>
      {renaming && (
        <SaveReportDialog
          open
          renameOnly
          existing={renaming}
          input={{ kind: renaming.kind, reportId: renaming.reportId, filters: renaming.filters, builder: renaming.builder }}
          defaultName={renaming.name}
          onClose={() => setRenaming(null)}
          onDone={(saved) => {
            setRenaming(null);
            setMessage(t('saved.updatedMessage', { name: saved.name }));
          }}
        />
      )}
      <ConfirmDialog
        open={deleting !== null}
        title={t('saved.deleteTitle')}
        text={t('saved.deleteBody', { name: deleting?.name ?? '' })}
        confirmLabel={t('actions.delete')}
        pending={remove.isPending}
        error={remove.isError ? tc(`apiErrors.${isApiError(remove.error) ? remove.error.code : 'SERVER'}`) : undefined}
        onClose={() => {
          remove.reset();
          setDeleting(null);
        }}
        onConfirm={() =>
          deleting &&
          remove.mutate(deleting.id, {
            onSuccess: () => {
              setMessage(t('saved.deletedMessage', { name: deleting.name }));
              setDeleting(null);
            },
          })
        }
      />
    </Box>
  );
}
