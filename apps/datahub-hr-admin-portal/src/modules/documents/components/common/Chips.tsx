import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import { useTranslation } from 'react-i18next';
import type { ComplianceStatus, Confidentiality, DocumentStatus, ExpiryStatus } from '@/modules/documents/types/documents';
import { COMPLIANCE_TONE, CONFIDENTIALITY_TONE, EXPIRY_TONE, STATUS_TONE } from '@/modules/documents/utils/format';

export function DocumentStatusChip({ status }: { status: DocumentStatus }) {
  const { t } = useTranslation('documents');
  return <Chip size="small" color={STATUS_TONE[status]} variant={status === 'verified' ? 'filled' : 'outlined'} label={t(`status.${status}`)} data-document-status={status} />;
}

export function ExpiryChip({ status }: { status: ExpiryStatus }) {
  const { t } = useTranslation('documents');
  return <Chip size="small" color={EXPIRY_TONE[status]} variant="outlined" label={t(`expiryStatus.${status}`)} />;
}

export function ConfidentialityChip({ level }: { level: Confidentiality }) {
  const { t } = useTranslation('documents');
  return <Chip size="small" color={CONFIDENTIALITY_TONE[level]} variant="outlined" label={t(`confidentiality.${level}`)} />;
}

export function ComplianceChip({ status }: { status: ComplianceStatus }) {
  const { t } = useTranslation('documents');
  return <Chip size="small" color={COMPLIANCE_TONE[status]} variant={status === 'verified' ? 'filled' : 'outlined'} label={t(`compliance.status.${status}`)} />;
}

/** A technical identifier (document reference, number, file name): left-to-right in every language. */
export function Code({ children }: { children: string }) {
  return (
    <Box component="span" dir="ltr" sx={{ fontFamily: 'monospace', fontSize: '0.85em', unicodeBidi: 'isolate', overflowWrap: 'anywhere' }}>
      {children}
    </Box>
  );
}

/** States plainly that files are not stored in this demo (no fake downloads anywhere). */
export function SimulatedStorageNotice({ compact = false }: { compact?: boolean }) {
  const { t } = useTranslation('documents');
  return (
    <Alert severity="warning" sx={compact ? { py: 0 } : undefined}>
      {compact ? t('storage.short') : t('storage.notice')}
    </Alert>
  );
}
