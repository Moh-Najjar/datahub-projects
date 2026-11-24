import { useMemo, useState } from 'react';
import Accordion from '@mui/material/Accordion';
import AccordionDetails from '@mui/material/AccordionDetails';
import AccordionSummary from '@mui/material/AccordionSummary';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlinedIcon from '@mui/icons-material/DeleteOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import FactCheckOutlinedIcon from '@mui/icons-material/FactCheckOutlined';
import { Link as RouterLink, useParams } from 'react-router-dom';
import { DEFAULT_EVALUATION_CATEGORIES } from '@/core/config/evaluationDefaults';
import { useBreadcrumbTail } from '@/core/hooks/breadcrumbContext';
import { ROUTES } from '@/core/routes/paths';
import { fill } from '@/i18n';
import { formatDate, formatNumber } from '@/i18n/format';
import { useLocale } from '@/i18n/LocaleContext';
import { useT } from '@/i18n/useT';
import { useEnrollmentsOfUser } from '@/modules/enrollments';
import { useUser } from '@/modules/users';
import { ConfirmDialog } from '@/modules/shared/ConfirmDialog';
import { useFeedback } from '@/modules/shared/hooks/feedbackContext';
import { PageContainer } from '@/modules/shared/PageContainer';
import { PageHeader } from '@/modules/shared/PageHeader';
import { ProgressIndicator } from '@/modules/shared/ProgressIndicator';
import { EmptyState, ErrorState, LoadingState } from '@/modules/shared/states';
import { EvaluationFormDialog } from './components/EvaluationFormDialog';
import { useDeleteEvaluation, useEvaluations } from './hooks/useEvaluations';
import type { EvaluationDto } from './types/evaluation';

/** One person's evaluations: the history (newest first), a clean form to add one, and edit / delete. */
export default function UserEvaluationsPage() {
  const t = useT();
  const { locale } = useLocale();
  const feedback = useFeedback();
  const { userId } = useParams();
  const user = useUser(userId);
  const evaluations = useEvaluations(userId);
  const enrollments = useEnrollmentsOfUser(userId);
  const del = useDeleteEvaluation();
  const [editing, setEditing] = useState<EvaluationDto | 'new' | null>(null);
  const [deleting, setDeleting] = useState<EvaluationDto | null>(null);
  useBreadcrumbTail(user.data ? `${user.data.fullName} — ${t.evaluations.breadcrumb}` : undefined);

  // New evaluations start from the previous one's categories (scores reset), else from the original ten defaults.
  const seedCategories = useMemo(() => {
    const latest = evaluations.data?.[0];
    if (latest) return latest.categories.map((c) => ({ categoryName: c.categoryName, criteria: c.criteria }));
    return DEFAULT_EVALUATION_CATEGORIES.map((_, index) => {
      const key = `c${String(index + 1).padStart(2, '0')}` as keyof typeof t.evaluations.defaults;
      return { categoryName: t.evaluations.defaults[key].name, criteria: t.evaluations.defaults[key].criteria };
    });
  }, [evaluations.data, t]);

  const error = user.error ?? evaluations.error;
  if (error && !user.data) {
    return (
      <PageContainer>
        <ErrorState error={error} onRetry={() => { user.refetch(); evaluations.refetch(); }} />
      </PageContainer>
    );
  }

  const newButton = (
    <Button variant="contained" startIcon={<AddIcon />} onClick={() => setEditing('new')} disabled={!user.data || !evaluations.data}>
      {t.evaluations.new}
    </Button>
  );

  return (
    <PageContainer>
      <PageHeader
        title={user.data ? fill(t.evaluations.titleFor, { name: user.data.fullName }) : t.evaluations.title}
        subtitle={user.data ? [t.roles[user.data.role], user.data.departmentName].filter(Boolean).join(' · ') : undefined}
        actions={
          <>
            <Button component={RouterLink} to={ROUTES.rankings} variant="outlined">
              {t.evaluations.backToRankings}
            </Button>
            {newButton}
          </>
        }
      />

      {evaluations.isLoading && <LoadingState />}
      {evaluations.isError && <ErrorState error={evaluations.error} onRetry={() => evaluations.refetch()} dense />}
      {evaluations.data && evaluations.data.length === 0 && (
        <EmptyState icon={<FactCheckOutlinedIcon />} title={t.evaluations.empty.title} description={t.evaluations.empty.body} action={newButton} />
      )}
      {evaluations.data && evaluations.data.length > 0 && (
        <Stack spacing={2} component="ul" sx={{ p: 0, m: 0, listStyle: 'none' }} aria-label={t.evaluations.history}>
          {evaluations.data.map((evaluation, index) => (
            <Box component="li" key={evaluation.id}>
              <Accordion variant="outlined" defaultExpanded={index === 0} disableGutters sx={{ borderRadius: 1, '&:before': { display: 'none' }, overflow: 'hidden' }}>
                <AccordionSummary expandIcon={<ExpandMoreIcon />} aria-controls={`eval-${evaluation.id}`} id={`eval-head-${evaluation.id}`}>
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={{ xs: 1, sm: 3 }} sx={{ alignItems: { sm: 'center' }, width: '100%', pr: 2 }}>
                    <Box sx={{ minWidth: 150 }}>
                      <Typography sx={{ fontWeight: 600 }}>{formatDate(evaluation.evaluatedAt, locale)}</Typography>
                      <Typography variant="body2" color="text.secondary">
                        {evaluation.evaluatedByUserName ? fill(t.evaluations.by, { name: evaluation.evaluatedByUserName }) : ''}
                      </Typography>
                    </Box>
                    <Box sx={{ minWidth: 220, flex: 1 }}>
                      <Typography sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{fill(t.evaluations.totalOf, { total: formatNumber(evaluation.total, locale), max: formatNumber(evaluation.maxTotal, locale) })}</Typography>
                      <ProgressIndicator value={(evaluation.total / evaluation.maxTotal) * 100} showValue={false} label={t.evaluations.totalLabel} />
                    </Box>
                    {evaluation.trainingTitle && <Chip size="small" variant="outlined" label={evaluation.trainingTitle} />}
                  </Stack>
                </AccordionSummary>
                <AccordionDetails id={`eval-${evaluation.id}`} sx={{ pt: 0 }}>
                  <Table size="small" aria-label={t.evaluations.categories}>
                    <TableHead>
                      <TableRow>
                        <TableCell>{t.evaluations.fields.category}</TableCell>
                        <TableCell>{t.evaluations.fields.criteria}</TableCell>
                        <TableCell align="right">{t.evaluations.scoreHeader}</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {evaluation.categories.map((category) => (
                        <TableRow key={category.id}>
                          <TableCell sx={{ fontWeight: 600 }}>{category.categoryName}</TableCell>
                          <TableCell sx={{ color: 'text.secondary' }}>{category.criteria || '—'}</TableCell>
                          <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums', fontWeight: 700 }}>
                            {formatNumber(category.score, locale)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', mt: 1.5 }}>
                    <Stack direction="row" spacing={1}>
                      {evaluation.departmentName && <Chip size="small" label={evaluation.departmentName} />}
                      {evaluation.trainingId && evaluation.trainingTitle && (
                        <Chip size="small" component={RouterLink} to={ROUTES.training(evaluation.trainingId)} clickable label={evaluation.trainingTitle} />
                      )}
                      {evaluation.updatedAt && <Chip size="small" variant="outlined" label={fill(t.evaluations.updatedOn, { date: formatDate(evaluation.updatedAt, locale) })} />}
                    </Stack>
                    <Stack direction="row">
                      <Tooltip title={t.common.edit}>
                        <IconButton size="small" aria-label={`${t.common.edit}: ${formatDate(evaluation.evaluatedAt, locale)}`} onClick={() => setEditing(evaluation)}>
                          <EditOutlinedIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title={t.common.delete}>
                        <IconButton size="small" color="error" aria-label={`${t.common.delete}: ${formatDate(evaluation.evaluatedAt, locale)}`} onClick={() => setDeleting(evaluation)}>
                          <DeleteOutlinedIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Stack>
                  </Stack>
                </AccordionDetails>
              </Accordion>
            </Box>
          ))}
        </Stack>
      )}

      {editing && userId && (
        <EvaluationFormDialog
          userId={userId}
          enrollments={enrollments.data ?? []}
          evaluation={editing === 'new' ? null : editing}
          seedCategories={seedCategories}
          onClose={() => setEditing(null)}
          onSaved={(created) => feedback.success(created ? t.evaluations.created : t.evaluations.saved)}
        />
      )}
      <ConfirmDialog
        open={deleting !== null}
        title={t.evaluations.delete.title}
        message={t.evaluations.delete.message}
        confirmLabel={t.common.delete}
        destructive
        onConfirm={async () => {
          if (!deleting) return;
          await del.mutateAsync(deleting.id);
          feedback.success(t.evaluations.deleted);
        }}
        onClose={() => setDeleting(null)}
      />
    </PageContainer>
  );
}
