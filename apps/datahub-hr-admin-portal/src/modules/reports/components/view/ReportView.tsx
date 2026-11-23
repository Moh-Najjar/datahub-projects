import { useRef, useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import LinearProgress from '@mui/material/LinearProgress';
import Skeleton from '@mui/material/Skeleton';
import Typography from '@mui/material/Typography';
import BookmarkAddOutlined from '@mui/icons-material/BookmarkAddOutlined';
import FileDownloadOutlined from '@mui/icons-material/FileDownloadOutlined';
import PrintOutlined from '@mui/icons-material/PrintOutlined';
import type { UseQueryResult } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { isApiError } from '@/core/api/types';
import { formatNumber } from '@/i18n/format';
import { useLanguage } from '@/i18n/useLanguage';
import { Panel } from '@/modules/shared/Panel';
import { visuallyHidden } from '@/modules/shared/styles';
import { downloadText } from '@/modules/shared/utils/download';
import { printDocument } from '@/modules/shared/utils/print';
import { useExportReport, type ExportRequest } from '@/modules/reports/hooks/useReports';
import type { ReportResult, SavedReport, SavedReportInput } from '@/modules/reports/types/reports';
import { formatTime, label } from '@/modules/reports/utils/format';
import { useDescribeFilters } from '@/modules/reports/hooks/useReportLabels';
import { SaveReportDialog } from '../saved/SaveReportDialog';
import { ReportChart, ReportNotes, SummaryTiles } from './parts';
import { PrintableReport } from './PrintableReport';
import { ResultTable } from './ResultTable';

interface Props {
  query: UseQueryResult<ReportResult>;
  title: string;
  description: string;
  /** CSV export of exactly this report (null = no export). */
  exportRequest: ExportRequest | null;
  /** What "Save report" stores (null = not savable). */
  saveInput: Omit<SavedReportInput, 'name'> | null;
  /** The saved report this view was opened from (offers "Update"). */
  savedFrom?: SavedReport | null;
}

/**
 * One generated report: key figures, chart, every record (search / sort / pages), how it is calculated and its
 * limitations; export to CSV, print to PDF through the browser, save its configuration. Loading, validation, access
 * and error states come from the query.
 */
export function ReportView({ query, title, description, exportRequest, saveInput, savedFrom = null }: Props) {
  const { t } = useTranslation('reports');
  const { t: tc } = useTranslation();
  const { language } = useLanguage();
  const describe = useDescribeFilters();
  const exporter = useExportReport();
  const chartRef = useRef<HTMLDivElement>(null);
  const [message, setMessage] = useState<{ severity: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const r = query.data;

  const exportCsv = () => {
    if (!exportRequest) return;
    exporter.mutate(
      { request: exportRequest, language },
      {
        onSuccess: (file) => {
          downloadText(file.fileName, file.content);
          setMessage({ severity: 'success', text: t('view.exported', { rows: formatNumber(file.rows, language), file: file.fileName }) });
        },
        onError: () => setMessage({ severity: 'error', text: t('view.exportFailed') }),
      },
    );
  };

  const print = async () => {
    if (!r) return;
    const svg = chartRef.current?.querySelector('svg')?.outerHTML ?? null;
    const { renderToStaticMarkup } = await import('react-dom/server');
    const markup = renderToStaticMarkup(<PrintableReport result={r} title={title} description={description} filters={describe(r.filters)} chartSvg={svg} t={t} language={language} />);
    if (!printDocument(title, markup, language)) setMessage({ severity: 'error', text: t('view.printUnavailable') });
    else setMessage({ severity: 'info', text: t('print.hint') });
  };

  const error = query.error;
  let body;
  if (query.isPending)
    body = (
      <>
        <Box component="span" role="status" sx={visuallyHidden}>
          {tc('shell.loading')}
        </Box>
        <Skeleton variant="rounded" height={88} sx={{ mb: 2 }} />
        <Skeleton variant="rounded" height={260} />
      </>
    );
  else if (query.isError && isApiError(error) && error.code === 'VALIDATION') {
    const reason = Object.values(error.fieldErrors ?? {})[0]?.[0] ?? 'invalid';
    body = <Alert severity="warning">{t('view.fixFilters', { reason: t(`validation.${reason}` as never, { defaultValue: reason }) as string })}</Alert>;
  } else if (query.isError && isApiError(error) && error.code === 'FORBIDDEN') body = <Alert severity="warning">{t('view.forbidden')}</Alert>;
  else if (query.isError || !r)
    body = (
      <Alert
        severity="error"
        action={
          <Button color="inherit" size="small" onClick={() => void query.refetch()}>
            {tc('actions.retry')}
          </Button>
        }
      >
        {t('view.loadError')}
      </Alert>
    );
  else
    body = (
      <Box sx={{ display: 'grid', gap: 2.5, position: 'relative', minWidth: 0, gridTemplateColumns: 'minmax(0, 1fr)' }}>
        {query.isFetching && <LinearProgress aria-hidden sx={{ position: 'absolute', top: -12, left: 0, right: 0, height: 2 }} />}
        <Typography variant="body2" color="text.secondary">
          {t('view.generatedAt', { time: formatTime(r.generatedAt, language) })}
          {r.currency ? ` · ${t('view.currency', { currency: r.currency })}` : ''}
          {` · ${t('view.records', { rows: formatNumber(r.rows.length, language) })}`}
        </Typography>
        {r.insufficient && <Alert severity="info">{t('view.insufficient')}</Alert>}
        <SummaryTiles items={r.summary} label={t('view.summary')} />
        {r.chart && (
          <Box ref={chartRef} component="figure" aria-label={t('view.chart')} sx={{ m: 0, p: { xs: 1, sm: 1.5 }, border: 1, borderColor: 'divider', borderRadius: 1, minWidth: 0 }}>
            <ReportChart spec={r.chart} title={`${title} — ${r.chart.series.map((s) => label(t, s.key)).join(', ')}`} />
          </Box>
        )}
        {r.columns.length > 0 && <ResultTable columns={r.columns} rows={r.rows} currency={r.currency} caption={title} />}
        <ReportNotes basis={r.basis} limitations={r.limitations} />
      </Box>
    );

  return (
    <Panel
      title={title}
      subtitle={description}
      actions={
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
          {saveInput && (
            <Button variant="text" startIcon={<BookmarkAddOutlined />} onClick={() => setSaving(true)}>
              {t('actions.save')}
            </Button>
          )}
          <Button variant="outlined" startIcon={<PrintOutlined />} disabled={!r} onClick={() => void print()}>
            {t('actions.print')}
          </Button>
          {exportRequest && (
            <Button variant="outlined" startIcon={<FileDownloadOutlined />} disabled={!r || exporter.isPending} onClick={exportCsv}>
              {t('actions.exportCsv')}
            </Button>
          )}
        </Box>
      }
    >
      {savedFrom && (
        <Alert severity="info" variant="outlined" sx={{ mb: 2 }}>
          {t('saved.openedFrom', { name: savedFrom.name })}
        </Alert>
      )}
      {message && (
        <Alert severity={message.severity} onClose={() => setMessage(null)} sx={{ mb: 2 }} role={message.severity === 'error' ? 'alert' : 'status'}>
          {message.text}
        </Alert>
      )}
      {body}
      {saveInput && (
        <SaveReportDialog
          open={saving}
          onClose={() => setSaving(false)}
          input={saveInput}
          existing={savedFrom}
          defaultName={title}
          onDone={(saved, created) => {
            setSaving(false);
            setMessage({ severity: 'success', text: created ? t('saved.savedMessage', { name: saved.name }) : t('saved.updatedMessage', { name: saved.name }) });
          }}
        />
      )}
    </Panel>
  );
}
