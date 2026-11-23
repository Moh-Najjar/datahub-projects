import { useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import FormGroup from '@mui/material/FormGroup';
import FormLabel from '@mui/material/FormLabel';
import MenuItem from '@mui/material/MenuItem';
import Skeleton from '@mui/material/Skeleton';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import PlayArrowOutlined from '@mui/icons-material/PlayArrowOutlined';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { Panel } from '@/modules/shared/Panel';
import { useReportCatalog } from '@/modules/reports/hooks/useReportCatalog';
import { useCustomReport, useReport, useSavedReports } from '@/modules/reports/hooks/useReports';
import { BUILDER_DATASETS, type BuilderConfig, type BuilderDataset, type SavedReport } from '@/modules/reports/types/reports';
import { canGroupBy } from '@/modules/reports/utils/builder';
import { defaultFilters, relevantFilters } from '@/modules/reports/utils/filters';
import { label } from '@/modules/reports/utils/format';
import { useReportTitle } from '@/modules/reports/hooks/useReportLabels';
import { ReportFiltersBar } from './filters/ReportFiltersBar';
import { ReportView } from './view/ReportView';

/**
 * `/reports/builder`: a report built from an existing dataset (a catalogue report's records) — choose its fields,
 * grouping and order, preview it, export or save it. Only datasets and fields the user's permissions allow are offered.
 * `?saved=<id>` reopens a saved builder configuration.
 */
export function BuilderSection() {
  const [params] = useSearchParams();
  const savedId = params.get('saved');
  const saved = useSavedReports();
  const from = savedId ? (saved.data?.find((s) => s.id === savedId && s.kind === 'custom') ?? null) : null;
  if (savedId && saved.isPending) return <Skeleton variant="rounded" height={320} />;
  // Remount for another saved configuration: the form starts from it (no syncing effects).
  return <BuilderForm key={from?.id ?? 'new'} saved={from} />;
}

function BuilderForm({ saved }: { saved: SavedReport | null }) {
  const { t } = useTranslation('reports');
  const catalog = useReportCatalog();
  const titleOf = useReportTitle();
  const datasets = BUILDER_DATASETS.filter((d) => catalog.canRun(d));
  const initial = saved?.builder ?? null;
  const [dataset, setDataset] = useState<BuilderDataset>(initial?.dataset ?? datasets[0]!);
  const [filters, setFilters] = useState(initial?.filters ?? defaultFilters());
  const [fields, setFields] = useState<string[] | null>(initial?.fields ?? null);
  const [groupBy, setGroupBy] = useState<string | null>(initial?.groupBy ?? null);
  const [sortBy, setSortBy] = useState<string | null>(initial?.sortBy ?? null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>(initial?.sortDirection ?? 'asc');
  const [applied, setApplied] = useState<BuilderConfig | null>(initial);

  const filterFields = catalog.filtersOf(dataset);
  const base = useReport(dataset, relevantFilters(filters, filterFields));
  const columns = base.data?.id === dataset ? base.data.columns : [];
  const chosen = fields ?? columns.slice(0, 5).map((c) => c.key);
  const current: BuilderConfig = { dataset, fields: chosen, groupBy, sortBy, sortDirection, filters: relevantFilters(filters, filterFields) };
  const custom = useCustomReport(applied);
  const changed = applied !== null && JSON.stringify(applied) !== JSON.stringify(current);

  const changeDataset = (next: BuilderDataset) => {
    setDataset(next);
    setFields(null);
    setGroupBy(null);
    setSortBy(null);
  };
  const toggle = (key: string) => setFields(chosen.includes(key) ? chosen.filter((k) => k !== key) : columns.map((c) => c.key).filter((k) => k === key || chosen.includes(k)));

  return (
    <Box sx={{ display: 'grid', gap: 2.5, minWidth: 0, gridTemplateColumns: 'minmax(0, 1fr)' }}>
      <Alert severity="info">{t('builder.intro')}</Alert>
      <Panel title={t('tabs.builder')}>
        <Box sx={{ display: 'grid', gap: 2.5 }}>
          <TextField select size="small" label={t('builder.dataset')} value={dataset} onChange={(e) => changeDataset(e.target.value as BuilderDataset)} sx={{ width: { xs: '100%', sm: 360 } }}>
            {datasets.map((d) => (
              <MenuItem key={d} value={d}>
                {t(`tabs.${d.split('.')[0] as 'employees'}`)} · {titleOf(d).title}
              </MenuItem>
            ))}
          </TextField>
          <ReportFiltersBar fields={filterFields} value={filters} onChange={setFilters} onReset={() => setFilters(defaultFilters())} />
          <Box component="fieldset" sx={{ border: 0, p: 0, m: 0, minWidth: 0 }}>
            <FormLabel component="legend">{t('builder.fields')}</FormLabel>
            <Typography variant="body2" color="text.secondary">
              {t('builder.fieldsHint')}
            </Typography>
            {base.isPending ? (
              <Typography role="status" color="text.secondary" sx={{ mt: 1 }}>
                {t('builder.loadingFields')}
              </Typography>
            ) : (
              <FormGroup row sx={{ mt: 0.5 }}>
                {columns.map((c) => (
                  <FormControlLabel key={c.key} control={<Checkbox size="small" checked={chosen.includes(c.key)} onChange={() => toggle(c.key)} />} label={label(t, c.key)} sx={{ minWidth: { xs: '50%', sm: 200 }, mr: 0 }} />
                ))}
              </FormGroup>
            )}
          </Box>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5 }}>
            <TextField select size="small" label={t('builder.groupBy')} value={groupBy ?? ''} onChange={(e) => setGroupBy(e.target.value || null)} sx={{ flex: '1 1 200px', maxWidth: { sm: 280 } }}>
              <MenuItem value="">{t('builder.noGrouping')}</MenuItem>
              {columns.filter(canGroupBy).map((c) => (
                <MenuItem key={c.key} value={c.key}>
                  {label(t, c.key)}
                </MenuItem>
              ))}
            </TextField>
            <TextField select size="small" label={t('builder.sortBy')} value={sortBy ?? ''} onChange={(e) => setSortBy(e.target.value || null)} sx={{ flex: '1 1 200px', maxWidth: { sm: 280 } }}>
              <MenuItem value="">{t('builder.defaultOrder')}</MenuItem>
              {groupBy && <MenuItem value="rows">{label(t, 'rows')}</MenuItem>}
              {columns
                .filter((c) => chosen.includes(c.key))
                .map((c) => (
                  <MenuItem key={c.key} value={c.key}>
                    {label(t, c.key)}
                  </MenuItem>
                ))}
            </TextField>
            <TextField select size="small" label={t('builder.direction')} value={sortDirection} onChange={(e) => setSortDirection(e.target.value as 'asc' | 'desc')} sx={{ flex: '1 1 150px', maxWidth: { sm: 200 } }}>
              <MenuItem value="asc">{t('builder.asc')}</MenuItem>
              <MenuItem value="desc">{t('builder.desc')}</MenuItem>
            </TextField>
          </Box>
          {groupBy && (
            <Typography variant="body2" color="text.secondary">
              {t('builder.groupHint')}
            </Typography>
          )}
          <Box>
            <Button variant="contained" startIcon={<PlayArrowOutlined />} disabled={!columns.length || !chosen.length} onClick={() => setApplied(current)}>
              {t('actions.preview')}
            </Button>
          </Box>
        </Box>
      </Panel>
      {changed && <Alert severity="info">{t('builder.changed')}</Alert>}
      {applied ? (
        <ReportView
          query={custom}
          title={`${t('builder.previewTitle')} · ${titleOf(applied.dataset).title}`}
          description={t('notes.builderDataset')}
          exportRequest={{ kind: 'custom', config: applied }}
          saveInput={{ kind: 'custom', reportId: null, filters: applied.filters, builder: applied }}
          savedFrom={saved}
        />
      ) : (
        <Typography color="text.secondary">{t('builder.needsPreview')}</Typography>
      )}
    </Box>
  );
}
