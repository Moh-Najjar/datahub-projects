import { useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Link from '@mui/material/Link';
import Stack from '@mui/material/Stack';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink } from 'react-router-dom';
import { formatNumber } from '@/i18n/format';
import { useLanguage } from '@/i18n/useLanguage';
import { useDepartmentOptions } from '@/modules/organization';
import { DataTable, type Column } from '@/modules/shared/DataTable';
import { Feedback } from '@/modules/shared/Feedback';
import { useFeedback } from '@/modules/shared/hooks/useFeedback';
import { useListState } from '@/modules/shared/hooks/useListState';
import { FilterSelect, ListToolbar } from '@/modules/shared/ListToolbar';
import { useAllCategories, useDocument, useExpiringDocuments, useExpirySummary } from '@/modules/documents/hooks/useDocuments';
import { useDocumentsAccess } from '@/modules/documents/hooks/useDocumentsAccess';
import { documentPaths } from '@/modules/documents/paths';
import { EXPIRY_WINDOWS, type DocumentSortField, type DocumentSummary, type ExpiryFilters, type ExpiryWindow } from '@/modules/documents/types/documents';
import { formatDay } from '@/modules/documents/utils/format';
import { Code, DocumentStatusChip } from './common/Chips';
import { UploadDialog } from './upload/UploadDialog';

/** Expired and soon-expiring documents, with replacement. Reminders are not sent (no e-mail / push in the demo). */
export function ExpirySection() {
  const { t } = useTranslation('documents');
  const { language } = useLanguage();
  const { canWrite, canWriteCandidates, organization, team } = useDocumentsAccess();
  const [range, setRange] = useState<ExpiryWindow>('30');
  const list = useListState<Omit<ExpiryFilters, 'window'>, DocumentSortField>('expiryDate', 'asc');
  const query = useExpiringDocuments({ ...list.params, filters: { ...list.params.filters, window: range } });
  const summary = useExpirySummary();
  const categories = useAllCategories();
  const { options: departments } = useDepartmentOptions({ enabled: organization || team });
  const [replacing, setReplacing] = useState<string | null>(null);
  const feedback = useFeedback();
  const s = summary.data;
  const counts: Record<ExpiryWindow, number | undefined> = { expired: s?.expired, '7': s?.within7, '30': s?.within30, '60': s?.within60, '90': s?.within90 };

  const columns: Column<DocumentSummary, DocumentSortField>[] = [
    { id: 'owner', label: t('fields.owner'), render: (d) => <Box><Typography variant="body2" sx={{ fontWeight: 500 }}>{d.owner.name[language]}</Typography><Typography variant="caption" color="text.secondary"><Code>{d.owner.number}</Code></Typography></Box> },
    {
      id: 'document',
      label: t('fields.document'),
      sortField: 'name',
      render: (d) => (
        <Link component={RouterLink} to={documentPaths.document(d.id)} underline="hover">
          {d.name}
        </Link>
      ),
    },
    { id: 'category', label: t('fields.category'), hideBelow: 'md', render: (d) => d.category.name[language] },
    { id: 'expiry', label: t('fields.expiryDate'), sortField: 'expiryDate', render: (d) => formatDay(d.expiryDate!, language) },
    {
      id: 'days',
      label: t('fields.daysRemaining'),
      align: 'right',
      render: (d) => (
        <Typography variant="body2" component="span" color={d.daysRemaining! < 0 ? 'error' : d.daysRemaining! <= 7 ? 'warning.main' : undefined} sx={{ fontWeight: 600 }}>
          {d.daysRemaining! < 0 ? t('expiry.daysAgo', { days: formatNumber(-d.daysRemaining!, language) }) : d.daysRemaining === 0 ? t('expiry.today') : t('expiry.daysLeft', { days: formatNumber(d.daysRemaining!, language) })}
        </Typography>
      ),
    },
    { id: 'department', label: t('fields.department'), hideBelow: 'lg', render: (d) => d.owner.department?.name[language] ?? '—' },
    { id: 'status', label: t('fields.status'), hideBelow: 'sm', render: (d) => <DocumentStatusChip status={d.status} /> },
    {
      id: 'replace',
      label: '',
      srLabel: t('actions.uploadReplacement'),
      align: 'right',
      render: (d) =>
        (d.owner.type === 'candidate' ? canWriteCandidates : canWrite) && !d.replacementRequested && d.owner.active ? (
          <Button size="small" onClick={() => setReplacing(d.id)} aria-label={t('expiry.replaceFor', { name: d.name, owner: d.owner.name[language] })}>
            {t('actions.replace')}
          </Button>
        ) : null,
    },
  ];

  return (
    <Stack spacing={2}>
      <Alert severity="info">{t('expiry.hint', { days: s?.thresholdDays ?? 30 })}</Alert>
      <ToggleButtonGroup
        exclusive
        size="small"
        value={range}
        onChange={(_, v: ExpiryWindow | null) => {
          if (!v) return;
          setRange(v);
          list.setPage(1);
        }}
        aria-label={t('expiry.window')}
        sx={{ flexWrap: 'wrap' }}
      >
        {EXPIRY_WINDOWS.map((w) => (
          <ToggleButton key={w} value={w} sx={{ textTransform: 'none' }}>
            {t(`expiry.windows.${w}`)}
            {counts[w] !== undefined && (
              <Box component="span" sx={{ marginInlineStart: 0.75, fontWeight: 700 }}>
                {formatNumber(counts[w]!, language)}
              </Box>
            )}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>
      <section aria-label={t('expiry.title')}>
        <ListToolbar
          search={list.search}
          onSearch={list.setSearch}
          searchLabel={t('directory.search')}
          hasFilters={list.hasFilters}
          onClear={list.clearFilters}
          filters={
            <>
              <FilterSelect label={t('fields.category')} value={list.filters.categoryId ?? ''} onChange={(v) => list.setFilter('categoryId', v || undefined)} allLabel={t('filters.allCategories')} options={(categories.data?.items ?? []).filter((c) => c.tracksExpiry).map((c) => ({ value: c.id, label: c.name[language] }))} />
              {(organization || team) && <FilterSelect label={t('fields.department')} value={list.filters.departmentId ?? ''} onChange={(v) => list.setFilter('departmentId', v || undefined)} allLabel={t('filters.allDepartments')} options={departments.map((o) => ({ value: o.value, label: o.label, depth: o.depth }))} />}
            </>
          }
        />
        <DataTable label={t('expiry.title')} columns={columns} getRowId={(d) => d.id} query={query} sort={list} pagination={list} filtered={list.hasFilters} />
      </section>
      <Typography variant="caption" color="text.secondary">
        {t('expiry.noReminders')}
      </Typography>
      {replacing && (
        <ReplaceLoader
          id={replacing}
          onClose={() => setReplacing(null)}
          onDone={() => {
            setReplacing(null);
            feedback.notify(t('details.replacementUploaded'));
          }}
        />
      )}
      <Feedback {...feedback} />
    </Stack>
  );
}

function ReplaceLoader({ id, onClose, onDone }: { id: string; onClose: () => void; onDone: () => void }) {
  const doc = useDocument(id);
  return doc.data ? <UploadDialog mode={{ kind: 'replace', document: doc.data }} onClose={onClose} onDone={onDone} /> : null;
}

