import { useEffect, useRef, useState } from 'react';
import Autocomplete from '@mui/material/Autocomplete';
import Box from '@mui/material/Box';
import Link from '@mui/material/Link';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import ArchiveOutlined from '@mui/icons-material/ArchiveOutlined';
import EditOutlined from '@mui/icons-material/EditOutlined';
import VisibilityOutlined from '@mui/icons-material/VisibilityOutlined';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink, useNavigate, useSearchParams } from 'react-router-dom';
import { useLanguage } from '@/i18n/useLanguage';
import { useDepartmentOptions } from '@/modules/organization';
import { DataTable, type Column } from '@/modules/shared/DataTable';
import { Feedback } from '@/modules/shared/Feedback';
import { useFeedback } from '@/modules/shared/hooks/useFeedback';
import { useListState } from '@/modules/shared/hooks/useListState';
import { FilterSelect, ListToolbar } from '@/modules/shared/ListToolbar';
import { RowActions } from '@/modules/shared/RowActions';
import { visuallyHidden } from '@/modules/shared/styles';
import { useAllCategories, useArchiveDocument, useDocument, useDocumentList, useOwnerOptions } from '@/modules/documents/hooks/useDocuments';
import { useDocumentsAccess } from '@/modules/documents/hooks/useDocumentsAccess';
import { documentPaths } from '@/modules/documents/paths';
import { DOCUMENT_STATUSES, EXPIRY_STATUSES, type DocumentFilters, type DocumentSortField, type DocumentStatus, type DocumentSummary, type ExpiryStatus, type OwnerOption } from '@/modules/documents/types/documents';
import { formatDay } from '@/modules/documents/utils/format';
import { errorText } from '@/modules/documents/utils/serverErrors';
import { Code, DocumentStatusChip, ExpiryChip } from './common/Chips';
import { EditDocumentDialog, TextDialog } from './details/DocumentDialogs';
import { UploadDialog } from './upload/UploadDialog';

const dateSlot = { inputLabel: { shrink: true }, htmlInput: { dir: 'ltr' } } as const;

/** Searchable, filterable directory of the documents the caller may see (server-side paging and sorting). */
export function DirectorySection() {
  const { t } = useTranslation('documents');
  const { t: tCommon } = useTranslation();
  const { language } = useLanguage();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { canWrite, canWriteCandidates, organization, team } = useDocumentsAccess();
  // Links from other modules (a leave request number) and the overview (pending review) pre-fill the filters: the list
  // STARTS with them (the first request is already filtered) and follows later changes of the URL.
  const initialSearch = params.get('search');
  const rawStatus = params.get('status');
  const initialStatus = rawStatus && (DOCUMENT_STATUSES as readonly string[]).includes(rawStatus) ? (rawStatus as DocumentStatus) : null;
  const list = useListState<DocumentFilters, DocumentSortField>('uploadedAt', 'desc', { search: initialSearch ?? undefined, filters: initialStatus ? { status: initialStatus } : {} });
  const { setSearch, setFilter } = list;
  // Not on every render (the list state functions are recreated each render): only when the URL values change.
  const applied = useRef<string | null>(`${initialSearch ?? ''}|${initialStatus ?? ''}`);
  useEffect(() => {
    const key = `${initialSearch ?? ''}|${initialStatus ?? ''}`;
    if (applied.current === key) return;
    applied.current = key;
    if (initialSearch) setSearch(initialSearch);
    if (initialStatus) setFilter('status', initialStatus);
  }, [initialSearch, initialStatus, setSearch, setFilter]);
  const sortBy = list.sortBy === 'owner.name.en' || list.sortBy === 'owner.name.ar' ? (`owner.name.${language}` as const) : list.sortBy;
  const query = useDocumentList({ ...list.params, sortBy });
  const categories = useAllCategories();
  const { options: departments } = useDepartmentOptions({ enabled: organization || team });
  const [ownerSearch, setOwnerSearch] = useState('');
  const [owner, setOwner] = useState<OwnerOption | null>(null);
  const owners = useOwnerOptions('employee', ownerSearch);
  const [uploading, setUploading] = useState(false);
  const [action, setAction] = useState<{ kind: 'edit' | 'archive'; id: string } | null>(null);
  const feedback = useFeedback();
  const canUpload = canWrite || canWriteCandidates;

  const columns: Column<DocumentSummary, DocumentSortField>[] = [
    {
      id: 'name',
      label: t('fields.document'),
      sortField: 'name',
      render: (d) => (
        <Box sx={{ minWidth: 0 }}>
          <Link component={RouterLink} to={documentPaths.document(d.id)} underline="hover" sx={{ fontWeight: 500 }}>
            {d.name}
          </Link>
          <Typography variant="caption" color="text.secondary" component="div">
            <Code>{d.reference}</Code>
            <Box component="span" sx={{ display: { md: 'none' } }}>
              {' · '}
              {d.owner.name[language]}
            </Box>
          </Typography>
        </Box>
      ),
    },
    { id: 'number', label: t('fields.documentNumber'), hideBelow: 'xl', render: (d) => (d.documentNumber ? <Code>{d.documentNumber}</Code> : '—') },
    { id: 'owner', label: t('fields.owner'), sortField: 'owner.name.en', hideBelow: 'md', render: (d) => (d.owner.type === 'candidate' ? `${d.owner.name[language]} (${t('ownerType.candidate')})` : d.owner.name[language]) },
    { id: 'ownerNumber', label: t('fields.ownerNumber'), hideBelow: 'lg', render: (d) => <Code>{d.owner.number}</Code> },
    { id: 'department', label: t('fields.department'), hideBelow: 'xl', render: (d) => d.owner.department?.name[language] ?? '—' },
    { id: 'category', label: t('fields.category'), sortField: 'category', hideBelow: 'sm', render: (d) => d.category.name[language] },
    { id: 'issue', label: t('fields.issueDate'), sortField: 'issueDate', hideBelow: 'xl', render: (d) => (d.issueDate ? formatDay(d.issueDate, language) : '—') },
    { id: 'expiry', label: t('fields.expiryDate'), sortField: 'expiryDate', hideBelow: 'lg', render: (d) => (d.expiryDate ? <Box>{formatDay(d.expiryDate, language)} <ExpiryChip status={d.expiryStatus} /></Box> : '—') },
    { id: 'status', label: t('fields.status'), sortField: 'status', render: (d) => <DocumentStatusChip status={d.status} /> },
    { id: 'uploaded', label: t('fields.uploadedAt'), sortField: 'uploadedAt', hideBelow: 'lg', render: (d) => formatDay(d.uploadedAt, language) },
    {
      id: 'actions',
      label: <Box component="span" sx={visuallyHidden}>{tCommon('list.actions')}</Box>,
      align: 'right',
      render: (d) => (
        <RowActions
          name={d.name}
          actions={[
            { label: t('actions.view'), icon: VisibilityOutlined, to: documentPaths.document(d.id) },
            ...((d.owner.type === 'candidate' ? canWriteCandidates : canWrite) && d.verificationStatus !== 'archived' && d.verificationStatus !== 'superseded'
              ? [
                  { label: t('actions.edit'), icon: EditOutlined, onClick: () => setAction({ kind: 'edit', id: d.id }) },
                  { label: t('actions.archive'), icon: ArchiveOutlined, onClick: () => setAction({ kind: 'archive', id: d.id }) },
                ]
              : []),
          ]}
        />
      ),
    },
  ];

  return (
    <Stack spacing={2}>
      <section aria-label={t('directory.title')}>
        <ListToolbar
          search={list.search}
          onSearch={list.setSearch}
          searchLabel={t('directory.search')}
          hasFilters={list.hasFilters}
          onClear={() => {
            list.clearFilters();
            setOwner(null);
          }}
          createLabel={canUpload ? t('actions.upload') : undefined}
          onCreate={canUpload ? () => setUploading(true) : undefined}
          filters={
            <>
              <FilterSelect label={t('fields.category')} value={list.filters.categoryId ?? ''} onChange={(v) => list.setFilter('categoryId', v || undefined)} allLabel={t('filters.allCategories')} options={(categories.data?.items ?? []).map((c) => ({ value: c.id, label: c.name[language] }))} />
              <FilterSelect label={t('fields.status')} value={list.filters.status ?? ''} onChange={(v) => list.setFilter('status', (v || undefined) as DocumentStatus | undefined)} allLabel={t('filters.allStatuses')} options={DOCUMENT_STATUSES.map((s) => ({ value: s, label: t(`status.${s}`) }))} />
              <FilterSelect label={t('fields.expiry')} value={list.filters.expiryStatus ?? ''} onChange={(v) => list.setFilter('expiryStatus', (v || undefined) as ExpiryStatus | undefined)} allLabel={t('filters.allExpiry')} options={EXPIRY_STATUSES.map((s) => ({ value: s, label: t(`expiryStatus.${s}`) }))} />
              {(organization || team) && <FilterSelect label={t('fields.department')} value={list.filters.departmentId ?? ''} onChange={(v) => list.setFilter('departmentId', v || undefined)} allLabel={t('filters.allDepartments')} options={departments.map((o) => ({ value: o.value, label: o.label, depth: o.depth }))} />}
              <Autocomplete
                size="small"
                sx={{ flex: '1 1 200px', minWidth: 180, maxWidth: { sm: 260 } }}
                options={owners.data ?? []}
                value={owner}
                filterOptions={(x) => x}
                isOptionEqualToValue={(a, b) => a.id === b.id}
                getOptionLabel={(o) => `${o.name[language]} (${o.number})`}
                onInputChange={(_, v) => setOwnerSearch(v)}
                onChange={(_, v) => {
                  setOwner(v);
                  list.setFilter('ownerId', v?.id || undefined);
                }}
                renderInput={(p) => <TextField {...p} label={t('fields.employee')} />}
              />
              <TextField size="small" type="date" label={t('filters.uploadedFrom')} value={list.filters.from ?? ''} onChange={(e) => list.setFilter('from', e.target.value || undefined)} slotProps={dateSlot} sx={{ flex: '1 1 150px', minWidth: 150, maxWidth: { sm: 180 } }} />
              <TextField size="small" type="date" label={t('filters.uploadedTo')} value={list.filters.to ?? ''} onChange={(e) => list.setFilter('to', e.target.value || undefined)} slotProps={dateSlot} sx={{ flex: '1 1 150px', minWidth: 150, maxWidth: { sm: 180 } }} />
            </>
          }
        />
        <DataTable label={t('directory.title')} columns={columns} getRowId={(d) => d.id} query={query} sort={list} pagination={list} filtered={list.hasFilters} />
      </section>
      {uploading && <UploadDialog mode={{ kind: 'create' }} onClose={() => setUploading(false)} onDone={(d) => navigate(documentPaths.document(d.id), { state: { notice: t('upload.done', { name: d.name }) } })} />}
      {action && (
        <RowDialog
          action={action}
          onClose={() => setAction(null)}
          onDone={(text) => {
            setAction(null);
            feedback.notify(text);
          }}
        />
      )}
      <Feedback {...feedback} />
    </Stack>
  );
}

/** Loads the full document, then edits or archives it from a directory row. */
function RowDialog({ action, onClose, onDone }: { action: { kind: 'edit' | 'archive'; id: string }; onClose: () => void; onDone: (text: string) => void }) {
  const { t } = useTranslation('documents');
  const { t: tCommon } = useTranslation();
  const doc = useDocument(action.id);
  const archive = useArchiveDocument();
  if (!doc.data) return null;
  if (action.kind === 'edit') return <EditDocumentDialog document={doc.data} onClose={onClose} onDone={() => onDone(t('details.saved'))} />;
  return (
    <TextDialog
      title={t('archive.title', { name: doc.data.name })}
      hint={t('archive.hint')}
      label={t('fields.reason')}
      submitLabel={t('actions.archive')}
      pending={archive.isPending}
      error={archive.isError ? errorText(t, tCommon, archive.error) : undefined}
      onSubmit={(reason) => archive.mutate({ id: action.id, reason }, { onSuccess: () => onDone(t('archive.done')) })}
      onClose={onClose}
    />
  );
}
