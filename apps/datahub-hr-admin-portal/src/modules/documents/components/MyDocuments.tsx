import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import LinearProgress from '@mui/material/LinearProgress';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useTranslation } from 'react-i18next';
import { isApiError } from '@/core/api/types';
import { Panel } from '@/modules/shared/Panel';
import { useMyDocuments } from '@/modules/documents/hooks/useDocuments';
import { SimulatedStorageNotice } from './common/Chips';
import { DocumentList } from './common/DocumentList';
import { ComplianceChecklist } from './compliance/ComplianceChecklist';

/**
 * My documents (hr.documents.view.own — every staff member): own documents of employee-visible categories and the own
 * checklist. Restricted categories and internal HR notes are never sent to the browser.
 */
export function MyDocuments() {
  const { t } = useTranslation('documents');
  const { t: tCommon } = useTranslation();
  const query = useMyDocuments();
  if (query.isPending) return <LinearProgress aria-label={tCommon('shell.loading')} />;
  if (query.isError) {
    if (isApiError(query.error) && query.error.code === 'NOT_FOUND') return <Alert severity="info">{t('my.noEmployeeRecord')}</Alert>;
    return (
      <Alert severity="error" action={<Button color="inherit" size="small" onClick={() => void query.refetch()}>{tCommon('actions.retry')}</Button>}>
        {tCommon('list.loadError')}
      </Alert>
    );
  }
  const docs = query.data.documents.filter((d) => d.verificationStatus !== 'archived' && d.verificationStatus !== 'superseded');
  return (
    <Stack spacing={2.5}>
      <SimulatedStorageNotice compact />
      <Box sx={{ display: 'grid', gap: 2.5, gridTemplateColumns: { xs: '1fr', lg: '2fr 1fr' }, alignItems: 'start' }}>
        <Panel title={t('my.documents')} subtitle={t('my.subtitle')}>
          <DocumentList label={t('my.documents')} documents={docs} emptyText={t('my.none')} />
        </Panel>
        {query.data.compliance && (
          <Panel title={t('compliance.checklist')} subtitle={t('compliance.subtitleOne')}>
            <ComplianceChecklist compliance={query.data.compliance} />
          </Panel>
        )}
      </Box>
      <Typography variant="caption" color="text.secondary">
        {t('my.privacy')}
      </Typography>
    </Stack>
  );
}
