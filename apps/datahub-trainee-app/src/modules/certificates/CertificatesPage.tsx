import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import WorkspacePremiumOutlinedIcon from '@mui/icons-material/WorkspacePremiumOutlined';
import { Link as RouterLink } from 'react-router-dom';
import { useAuth } from '@/core/auth/authContext';
import { isLearnerRole } from '@/core/auth/trainingPolicy';
import { ROUTES } from '@/core/routes/paths';
import { formatDate } from '@/i18n/format';
import { useLocale } from '@/i18n/LocaleContext';
import { useT } from '@/i18n/useT';
import { DataTable, type Column } from '@/modules/shared/DataTable';
import { FilterBar, SearchInput } from '@/modules/shared/FilterBar';
import { useListState } from '@/modules/shared/hooks/useListState';
import { PageContainer } from '@/modules/shared/PageContainer';
import { PageHeader } from '@/modules/shared/PageHeader';
import { UserAvatar } from '@/modules/shared/UserAvatar';
import { useCertificates } from './hooks/useCertificates';
import type { CertificateDto, CertificateFilters } from './types/certificate';

/** Completion certificates: a learner's own, or (staff) those of everyone completed in their scope. */
export default function CertificatesPage() {
  const t = useT();
  const { locale } = useLocale();
  const { actor } = useAuth();
  const learner = actor ? isLearnerRole(actor.role) : false;
  const list = useListState<CertificateFilters>({ pageSize: 10 });
  const query = useCertificates(list.params);

  const columns: Column<CertificateDto>[] = [
    {
      id: 'training',
      header: t.certificates.columns.training,
      render: (c) => (
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={{ fontWeight: 600 }} noWrap>
            {c.trainingTitle}
          </Typography>
          <Typography variant="body2" color="text.secondary" noWrap dir="ltr" sx={{ textAlign: 'start' }}>
            {c.reference}
          </Typography>
        </Box>
      ),
    },
    ...(learner
      ? []
      : [
          {
            id: 'trainee',
            header: t.certificates.columns.trainee,
            render: (c: CertificateDto) => (
              <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
                <UserAvatar name={c.traineeName} size={32} />
                <Typography sx={{ fontWeight: 600 }}>{c.traineeName}</Typography>
              </Stack>
            ),
          } satisfies Column<CertificateDto>,
        ]),
    { id: 'department', header: t.certificates.columns.department, hideBelow: 'md', render: (c) => c.departmentName ?? '—' },
    { id: 'completed', header: t.certificates.columns.completed, hideBelow: 'sm', render: (c) => formatDate(c.completedAt, locale) },
    {
      id: 'actions',
      header: t.common.actions,
      align: 'right',
      width: 150,
      render: (c) => (
        <Button size="small" variant="outlined" component={RouterLink} to={ROUTES.certificate(c.enrollmentId)} startIcon={<VisibilityOutlinedIcon />} aria-label={`${t.certificates.view}: ${c.trainingTitle}`}>
          {t.certificates.view}
        </Button>
      ),
    },
  ];

  return (
    <PageContainer>
      <PageHeader title={t.certificates.title} subtitle={learner ? t.certificates.subtitleLearner : t.certificates.subtitleStaff} />
      <FilterBar search={<SearchInput value={list.searchInput} onChange={list.setSearchInput} placeholder={t.certificates.search} />} hasActiveFilters={list.hasActiveFilters} onClear={list.clearFilters} />
      <DataTable
        label={t.certificates.title}
        columns={columns}
        rows={query.data?.items}
        getRowId={(c) => c.enrollmentId}
        isLoading={query.isLoading}
        error={query.error}
        onRetry={() => query.refetch()}
        hasActiveFilters={list.hasActiveFilters}
        empty={{ title: t.certificates.empty.title, description: learner ? t.certificates.empty.bodyLearner : t.certificates.empty.bodyStaff, icon: <WorkspacePremiumOutlinedIcon /> }}
        emptyFiltered={{ title: t.common.noMatches, description: t.common.noMatchesBody }}
        pagination={query.data ? { page: query.data.page, pageSize: query.data.pageSize, total: query.data.total, onPageChange: list.setPage, onPageSizeChange: list.setPageSize } : undefined}
      />
    </PageContainer>
  );
}
