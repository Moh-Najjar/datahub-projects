import Box from '@mui/material/Box';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useTranslation } from 'react-i18next';
import { isApiError } from '@/core/api/types';
import { Panel } from '@/modules/shared/Panel';
import { useReportCatalog, useUrlFilters } from '@/modules/reports/hooks/useReportCatalog';
import { useReport, useSavedReports } from '@/modules/reports/hooks/useReports';
import type { ReportCategory, ReportId } from '@/modules/reports/types/reports';
import { relevantFilters } from '@/modules/reports/utils/filters';
import { useReportTitle } from '@/modules/reports/hooks/useReportLabels';
import { ReportFiltersBar } from './filters/ReportFiltersBar';
import { ReportView } from './view/ReportView';

/**
 * One report category (`/reports/<category>?report=…`): choose a report the user may run, adjust its filters (only those
 * that apply) and read it. The report and filters live in the URL, so saved reports and bookmarks reopen it as it was.
 */
export function CategorySection({ category }: { category: ReportCategory }) {
  const { t } = useTranslation('reports');
  const catalog = useReportCatalog();
  const titleOf = useReportTitle();
  const { filters, setFilters, reset, params, setParams } = useUrlFilters();
  const ids = catalog.reportsOf(category);
  const requested = params.get('report') as ReportId | null;
  const id = requested && ids.includes(requested) ? requested : (ids[0] ?? null);
  const fields = id ? catalog.filtersOf(id) : [];
  const query = useReport(id, relevantFilters(filters, fields));
  const savedId = params.get('saved');
  const saved = useSavedReports();
  const savedFrom = (savedId && saved.data?.find((s) => s.id === savedId && s.reportId === id)) || null;
  const fieldErrors = isApiError(query.error) && query.error.code === 'VALIDATION' ? query.error.fieldErrors : undefined;

  const choose = (next: ReportId) =>
    setParams(
      (prev) => {
        const p = new URLSearchParams(prev);
        p.set('report', next);
        p.delete('saved');
        return p;
      },
      { replace: false },
    );

  if (!id) return null;
  const { title, description } = titleOf(id);
  return (
    <Box sx={{ display: 'grid', gap: 2.5, minWidth: 0, gridTemplateColumns: 'minmax(0, 1fr)' }}>
      <Panel title={t(`tabs.${category}`)} subtitle={t('filters.notApplicable')}>
        <Box sx={{ display: 'grid', gap: 2 }}>
          <Box>
            <TextField select size="small" label={t('actions.chooseReport')} value={id} onChange={(e) => choose(e.target.value as ReportId)} sx={{ width: { xs: '100%', sm: 360 } }}>
              {ids.map((x) => (
                <MenuItem key={x} value={x}>
                  {titleOf(x).title}
                </MenuItem>
              ))}
            </TextField>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
              {description}
            </Typography>
          </Box>
          <ReportFiltersBar fields={fields} value={filters} onChange={setFilters} onReset={reset} errors={fieldErrors} />
        </Box>
      </Panel>
      <ReportView
        key={id}
        query={query}
        title={title}
        description={description}
        exportRequest={{ kind: 'report', reportId: id, filters: relevantFilters(filters, fields) }}
        saveInput={{ kind: 'report', reportId: id, filters: relevantFilters(filters, fields), builder: null }}
        savedFrom={savedFrom}
      />
    </Box>
  );
}
