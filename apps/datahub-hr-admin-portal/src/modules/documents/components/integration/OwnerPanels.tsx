import { useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import LinearProgress from '@mui/material/LinearProgress';
import Link from '@mui/material/Link';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import type { Localized } from '@datahub/shared-types';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink } from 'react-router-dom';
import { navItem } from '@/core/routes/navigation';
import { useLanguage } from '@/i18n/useLanguage';
import { Feedback } from '@/modules/shared/Feedback';
import { useFeedback } from '@/modules/shared/hooks/useFeedback';
import { Panel } from '@/modules/shared/Panel';
import { useCandidateDocuments, useEmployeeDocuments } from '@/modules/documents/hooks/useDocuments';
import { useDocumentsAccess } from '@/modules/documents/hooks/useDocumentsAccess';
import type { OwnerOption } from '@/modules/documents/types/documents';
import { formatDay, formatMonth } from '@/modules/documents/utils/format';
import { Code, SimulatedStorageNotice } from '../common/Chips';
import { DocumentList } from '../common/DocumentList';
import { ComplianceChecklist } from '../compliance/ComplianceChecklist';
import { UploadDialog } from '../upload/UploadDialog';

/** Payslips are Payroll's: linked by URL from the navigation map (no import of the Payroll module). */
const payslipPath = (id: string) => `${navItem('payroll').path}/payslips/${encodeURIComponent(id)}`;

function Loading() {
  const { t: tCommon } = useTranslation();
  return <LinearProgress aria-label={tCommon('shell.loading')} />;
}

/**
 * Employee Profile → Documents tab: the employee's documents (from Documents Management — no copy), their required-
 * document checklist and payslip references. The API returns only what the viewer may see.
 */
export function EmployeeDocumentsTab({ employeeId }: { employeeId: string }) {
  const { t } = useTranslation('documents');
  const { t: tCommon } = useTranslation();
  const { language } = useLanguage();
  const { canWrite } = useDocumentsAccess();
  const query = useEmployeeDocuments(employeeId);
  const feedback = useFeedback();
  const [uploading, setUploading] = useState(false);
  if (query.isPending) return <Loading />;
  if (query.isError)
    return (
      <Alert severity="error" action={<Button color="inherit" size="small" onClick={() => void query.refetch()}>{tCommon('actions.retry')}</Button>}>
        {tCommon('list.loadError')}
      </Alert>
    );
  const data = query.data;
  const current = data.documents.filter((d) => d.verificationStatus !== 'archived' && d.verificationStatus !== 'superseded');
  const historical = data.documents.filter((d) => !current.includes(d));
  return (
    <Stack spacing={2.5}>
      <SimulatedStorageNotice compact />
      <Panel
        title={t('employeeTab.documents')}
        subtitle={t('employeeTab.subtitle')}
        actions={
          canWrite && (
            <Button size="small" variant="contained" onClick={() => setUploading(true)}>
              {t('actions.upload')}
            </Button>
          )
        }
      >
        <DocumentList label={t('employeeTab.documents')} documents={current} emptyText={t('employeeTab.none')} />
        {historical.length > 0 && (
          <Box sx={{ mt: 2 }}>
            <Typography variant="subtitle2" component="h3" sx={{ mb: 1 }}>
              {t('employeeTab.historical')}
            </Typography>
            <DocumentList label={t('employeeTab.historical')} documents={historical} emptyText="" />
          </Box>
        )}
      </Panel>
      {data.compliance && (
        <Panel title={t('compliance.checklist')} subtitle={t('compliance.subtitleOne')}>
          <ComplianceChecklist compliance={data.compliance} />
        </Panel>
      )}
      {data.payslips && (
        <Panel title={t('employeeTab.payslips')} subtitle={t('employeeTab.payslipsHint')}>
          {data.payslips.length === 0 ? (
            <Typography color="text.secondary">{t('employeeTab.noPayslips')}</Typography>
          ) : (
            <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0, display: 'grid', gap: 1, gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 220px), 1fr))' }} aria-label={t('employeeTab.payslips')}>
              {data.payslips.map((p) => (
                <Box component="li" key={p.id}>
                  <Link component={RouterLink} to={payslipPath(p.id)} underline="hover">
                    {formatMonth(p.periodStart.slice(0, 7), language)}
                  </Link>{' '}
                  <Typography variant="caption" color="text.secondary">
                    <Code>{p.number}</Code> · {formatDay(p.paymentDate, language)}
                  </Typography>
                </Box>
              ))}
            </Box>
          )}
        </Panel>
      )}
      {uploading && (
        <UploadDialog
          mode={{ kind: 'create', owner: data.owner }}
          onClose={() => setUploading(false)}
          onDone={(d) => {
            setUploading(false);
            feedback.notify(t('upload.done', { name: d.name }));
          }}
        />
      )}
      <Feedback {...feedback} />
    </Stack>
  );
}

/** Recruitment → candidate profile: candidate documents (recruitment users only — the API refuses everyone else). */
export function CandidateDocumentsPanel({ candidate }: { candidate: { id: string; name: Localized<string>; number: string } }) {
  const { t } = useTranslation('documents');
  const { t: tCommon } = useTranslation();
  const { canWriteCandidates, candidates } = useDocumentsAccess();
  const query = useCandidateDocuments(candidate.id, candidates);
  const feedback = useFeedback();
  const [uploading, setUploading] = useState(false);
  const owner: OwnerOption = { type: 'candidate', id: candidate.id, name: candidate.name, number: candidate.number, employmentType: null };
  return (
    <Stack spacing={2}>
      <SimulatedStorageNotice compact />
      <Panel
        title={t('candidateTab.title')}
        subtitle={t('candidateTab.subtitle')}
        actions={
          canWriteCandidates && (
            <Button size="small" variant="contained" onClick={() => setUploading(true)}>
              {t('actions.upload')}
            </Button>
          )
        }
      >
        {query.isPending ? (
          <Loading />
        ) : query.isError ? (
          <Alert severity="error">{tCommon('list.loadError')}</Alert>
        ) : (
          <DocumentList label={t('candidateTab.title')} documents={query.data} emptyText={t('candidateTab.none')} />
        )}
      </Panel>
      {uploading && (
        <UploadDialog
          mode={{ kind: 'create', owner }}
          onClose={() => setUploading(false)}
          onDone={(d) => {
            setUploading(false);
            feedback.notify(t('upload.done', { name: d.name }));
          }}
        />
      )}
      <Feedback {...feedback} />
    </Stack>
  );
}

/** Payroll → compensation page: the employee's payroll supporting documents (payroll categories only). */
export function PayrollDocumentsPanel({ employeeId }: { employeeId: string }) {
  const { t } = useTranslation('documents');
  const { t: tCommon } = useTranslation();
  const { canWrite } = useDocumentsAccess();
  const query = useEmployeeDocuments(employeeId);
  const feedback = useFeedback();
  const [uploading, setUploading] = useState(false);
  const docs = (query.data?.documents ?? []).filter((d) => d.category.group === 'payroll' && d.verificationStatus !== 'archived' && d.verificationStatus !== 'superseded');
  return (
    <Panel
      title={t('payrollPanel.title')}
      subtitle={t('payrollPanel.subtitle')}
      actions={
        canWrite &&
        query.data && (
          <Button size="small" variant="outlined" onClick={() => setUploading(true)}>
            {t('actions.upload')}
          </Button>
        )
      }
    >
      {query.isPending ? <Loading /> : query.isError ? <Alert severity="error">{tCommon('list.loadError')}</Alert> : <DocumentList label={t('payrollPanel.title')} documents={docs} emptyText={t('payrollPanel.none')} />}
      {uploading && query.data && (
        <UploadDialog
          mode={{ kind: 'create', owner: query.data.owner }}
          onClose={() => setUploading(false)}
          onDone={(d) => {
            setUploading(false);
            feedback.notify(t('upload.done', { name: d.name }));
          }}
        />
      )}
      <Feedback {...feedback} />
    </Panel>
  );
}
