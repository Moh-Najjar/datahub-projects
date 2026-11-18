import { useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import Link from '@mui/material/Link';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import ArrowBackOutlined from '@mui/icons-material/ArrowBackOutlined';
import InsertDriveFileOutlined from '@mui/icons-material/InsertDriveFileOutlined';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink, useLocation, useParams } from 'react-router-dom';
import { useBreadcrumbs } from '@/core/context/breadcrumbContext';
import { useLanguage } from '@/i18n/useLanguage';
import { Feedback } from '@/modules/shared/Feedback';
import { useFeedback } from '@/modules/shared/hooks/useFeedback';
import { DetailList, Panel, QueryBoundary } from '@/modules/shared/Panel';
import { useAddNote, useArchiveDocument, useDocument, useRejectDocument, useRequestReplacement, useVerifyDocument } from '@/modules/documents/hooks/useDocuments';
import { useDocumentsAccess } from '@/modules/documents/hooks/useDocumentsAccess';
import { documentPaths } from '@/modules/documents/paths';
import type { Document } from '@/modules/documents/types/documents';
import { fileSizeText } from '@/modules/documents/utils/rules';
import { formatDay, formatTimestamp } from '@/modules/documents/utils/format';
import { errorText } from '@/modules/documents/utils/serverErrors';
import { Code, ConfidentialityChip, DocumentStatusChip, ExpiryChip, SimulatedStorageNotice } from '../common/Chips';
import { UploadDialog } from '../upload/UploadDialog';
import { EditDocumentDialog, TextDialog } from './DocumentDialogs';

const backIconSx = { transform: (theme: { direction: string }) => (theme.direction === 'rtl' ? 'scaleX(-1)' : undefined) };

/** `/documents/directory/:documentId` — details, review decisions, replacement, notes and history. */
export function DocumentDetails() {
  const { t } = useTranslation('documents');
  const { documentId = '' } = useParams();
  const { beyondOwn } = useDocumentsAccess();
  const query = useDocument(documentId);
  const feedback = useFeedback();
  const notice = (useLocation().state as { notice?: string } | null)?.notice;
  return (
    <Stack spacing={2.5}>
      <div>
        <Button component={RouterLink} to={beyondOwn ? documentPaths.directory : documentPaths.overview} size="small" startIcon={<ArrowBackOutlined sx={backIconSx} />}>
          {beyondOwn ? t('actions.backToDirectory') : t('actions.backToMy')}
        </Button>
      </div>
      {notice && <Alert severity="success">{notice}</Alert>}
      <QueryBoundary query={query} notFoundText={t('details.notFound')}>
        {query.data && <DocumentView doc={query.data} notify={feedback.notify} />}
      </QueryBoundary>
      <Feedback {...feedback} />
    </Stack>
  );
}

type DialogKind = 'edit' | 'verify' | 'reject' | 'replacement' | 'replace' | 'archive' | 'note' | null;

function DocumentView({ doc: d, notify }: { doc: Document; notify: (text: string, severity?: 'success' | 'error') => void }) {
  const { t } = useTranslation('documents');
  const { t: tCommon } = useTranslation();
  const { language } = useLanguage();
  const { beyondOwn } = useDocumentsAccess();
  useBreadcrumbs(beyondOwn ? [{ label: t('tabs.directory'), to: documentPaths.directory }, { label: d.name }] : [{ label: d.name }]);
  const [dialog, setDialog] = useState<DialogKind>(null);
  const verify = useVerifyDocument();
  const reject = useRejectDocument();
  const replacement = useRequestReplacement();
  const archive = useArchiveDocument();
  const note = useAddNote();
  const close = () => setDialog(null);
  const done = (text: string) => () => {
    close();
    notify(text);
  };
  const open = (kind: DialogKind) => () => {
    [verify, reject, replacement, archive, note].forEach((m) => m.reset());
    setDialog(kind);
  };
  const day = (v: string | null) => (v ? formatDay(v, language) : '—');

  return (
    <>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1.5, minWidth: 0 }}>
          <Typography variant="h5" component="h2" sx={{ overflowWrap: 'anywhere' }}>
            {d.name}
          </Typography>
          <DocumentStatusChip status={d.status} />
          <ExpiryChip status={d.expiryStatus} />
          <ConfidentialityChip level={d.confidentiality} />
        </Box>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
          {d.can.verify && (
            <Button variant="contained" color="success" onClick={open('verify')}>
              {t('actions.verify')}
            </Button>
          )}
          {d.can.reject && (
            <Button variant="outlined" color="error" onClick={open('reject')}>
              {t('actions.reject')}
            </Button>
          )}
          {d.can.requestReplacement && (
            <Button variant="outlined" onClick={open('replacement')}>
              {t('actions.requestReplacement')}
            </Button>
          )}
          {d.can.replace && (
            <Button variant="outlined" onClick={open('replace')}>
              {t('actions.uploadReplacement')}
            </Button>
          )}
          {d.can.edit && (
            <Button variant="outlined" onClick={open('edit')}>
              {t('actions.edit')}
            </Button>
          )}
          {d.can.archive && (
            <Button color="error" onClick={open('archive')}>
              {t('actions.archive')}
            </Button>
          )}
        </Box>
      </Box>

      {d.verificationStatus === 'pending-review' && d.expiryStatus === 'expired' && <Alert severity="error">{t('details.expiredPending')}</Alert>}
      {d.verificationStatus === 'rejected' && <Alert severity="error">{t('details.rejected', { reason: d.lastReview?.reason ?? '' })}</Alert>}
      {d.replacementRequest && (
        <Alert severity="warning">
          {t('details.replacementRequested', { name: d.replacementRequest.by[language], reason: d.replacementRequest.reason })}
        </Alert>
      )}
      {d.replacedBy && (
        <Alert severity="info">
          {t('details.replacedBy')}{' '}
          <Link component={RouterLink} to={documentPaths.document(d.replacedBy.id)}>
            <Code>{d.replacedBy.reference}</Code>
          </Link>
        </Alert>
      )}
      {d.replaces && (
        <Alert severity="info">
          {t('details.replaces')}{' '}
          <Link component={RouterLink} to={documentPaths.document(d.replaces.id)}>
            <Code>{d.replaces.reference}</Code>
          </Link>
        </Alert>
      )}
      {d.status === 'expired' && <Alert severity="warning">{t('details.expiredNote')}</Alert>}

      <Box sx={{ display: 'grid', gap: 2.5, gridTemplateColumns: { xs: '1fr', lg: 'repeat(2, minmax(0, 1fr))' } }}>
        <Panel title={t('details.document')}>
          <DetailList
            items={[
              { label: t('fields.reference'), value: <Code>{d.reference}</Code> },
              { label: t('fields.category'), value: d.category.name[language] },
              { label: t('fields.documentNumber'), value: d.documentNumber ? <Code>{d.documentNumber}</Code> : '—' },
              { label: t('fields.issuingAuthority'), value: d.issuingAuthority || '—' },
              { label: t('fields.issueDate'), value: day(d.issueDate) },
              { label: t('fields.expiryDate'), value: d.expiryDate ? `${day(d.expiryDate)} · ${d.daysRemaining! >= 0 ? t('details.daysRemaining', { days: d.daysRemaining }) : t('details.daysAgo', { days: -d.daysRemaining! })}` : t('expiryStatus.no-expiry') },
              { label: t('fields.confidentiality'), value: t(`confidentiality.${d.confidentiality}`) },
              { label: t('fields.description'), value: d.description || '—' },
            ]}
          />
        </Panel>
        <Panel title={t('details.owner')}>
          <DetailList
            items={[
              { label: d.owner.type === 'employee' ? t('fields.employee') : t('fields.candidate'), value: d.owner.name[language] },
              { label: t('fields.ownerNumber'), value: <Code>{d.owner.number}</Code> },
              { label: t('fields.department'), value: d.owner.department?.name[language] ?? '—' },
              { label: t('fields.source'), value: d.source.module === 'leave' ? t('source.leave', { reference: d.source.reference ?? '' }) : d.owner.type === 'candidate' ? t('source.recruitment') : t('source.upload') },
              { label: t('fields.uploadedBy'), value: `${d.uploadedBy[language]} · ${formatTimestamp(d.uploadedAt, language)}` },
              { label: t('fields.updatedAt'), value: formatTimestamp(d.updatedAt, language) },
              { label: t('fields.reviewedBy'), value: d.lastReview ? `${d.lastReview.by[language]} · ${formatTimestamp(d.lastReview.at, language)} · ${t(`decision.${d.lastReview.decision}`)}` : '—' },
              ...(d.linkedEmployeeId ? [{ label: t('fields.linkedEmployee'), value: t('details.linkedAfterHire') }] : []),
            ]}
          />
        </Panel>
      </Box>

      <Panel title={t('details.files')}>
        <Stack spacing={1.5}>
          <SimulatedStorageNotice />
          <Stack component="ul" spacing={1} sx={{ listStyle: 'none', m: 0, p: 0 }} aria-label={t('details.files')}>
            {d.files.map((f) => (
              <Box component="li" key={f.name} sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
                <InsertDriveFileOutlined fontSize="small" color="action" />
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="body2" noWrap>
                    <Code>{f.name}</Code>
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    <span dir="ltr">
                      {f.type.toUpperCase()} · {fileSizeText(f.sizeBytes)}
                    </span>{' '}
                    · {t('details.notStored')}
                  </Typography>
                </Box>
              </Box>
            ))}
          </Stack>
        </Stack>
      </Panel>

      {d.internalNotes !== null && (
        <Panel
          title={t('details.notes')}
          subtitle={t('details.notesHint')}
          actions={
            d.can.addNote && (
              <Button size="small" variant="outlined" onClick={open('note')}>
                {t('actions.addNote')}
              </Button>
            )
          }
        >
          {d.internalNotes.length === 0 ? (
            <Typography color="text.secondary">{t('details.noNotes')}</Typography>
          ) : (
            <Stack component="ul" spacing={1} sx={{ listStyle: 'none', m: 0, p: 0 }}>
              {[...d.internalNotes].reverse().map((n) => (
                <Box component="li" key={n.at}>
                  <Typography variant="body2">{n.text}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {n.by[language]} · {formatTimestamp(n.at, language)}
                  </Typography>
                </Box>
              ))}
            </Stack>
          )}
        </Panel>
      )}

      <Panel title={t('details.history')}>
        <Stack component="ol" spacing={1.25} sx={{ listStyle: 'none', m: 0, p: 0 }} aria-label={t('details.history')}>
          {d.history.map((h, i) => (
            <Box component="li" key={`${h.at}-${i}`} sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'baseline' }} data-history={h.action}>
              <Typography variant="body2" sx={{ fontWeight: 500 }}>
                {t(`history.${h.action}`, { by: h.by[language] })}
              </Typography>
              {h.note && (
                <Typography variant="body2" color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>
                  {h.relatedId ? (
                    <Link component={RouterLink} to={documentPaths.document(h.relatedId)}>
                      <Code>{h.note}</Code>
                    </Link>
                  ) : (
                    `“${h.note}”`
                  )}
                </Typography>
              )}
              <Typography variant="caption" color="text.secondary" sx={{ marginInlineStart: 'auto' }}>
                {formatTimestamp(h.at, language)}
              </Typography>
            </Box>
          ))}
        </Stack>
      </Panel>

      {dialog === 'edit' && <EditDocumentDialog document={d} onClose={close} onDone={done(t('details.saved'))} />}
      {dialog === 'replace' && <UploadDialog mode={{ kind: 'replace', document: d }} onClose={close} onDone={done(t('details.replacementUploaded'))} />}
      {dialog === 'verify' && (
        <Dialog open onClose={verify.isPending ? undefined : close} maxWidth="xs" fullWidth aria-labelledby="verify-title">
          <DialogTitle id="verify-title">{t('verify.title', { name: d.name })}</DialogTitle>
          <DialogContent>
            <DialogContentText>{d.replaces ? t('verify.replacesText', { reference: d.replaces.reference }) : t('verify.text')}</DialogContentText>
            {verify.isError && (
              <Alert severity="error" role="alert" sx={{ mt: 2 }}>
                {errorText(t, tCommon, verify.error)}
              </Alert>
            )}
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={close} disabled={verify.isPending}>
              {tCommon('actions.cancel')}
            </Button>
            <Button variant="contained" color="success" disabled={verify.isPending} onClick={() => verify.mutate(d.id, { onSuccess: done(t('verify.done')) })}>
              {t('actions.verify')}
            </Button>
          </DialogActions>
        </Dialog>
      )}
      {dialog === 'reject' && <TextDialog title={t('reject.title', { name: d.name })} hint={t('reject.hint')} label={t('fields.reason')} submitLabel={t('actions.reject')} pending={reject.isPending} error={reject.isError ? errorText(t, tCommon, reject.error) : undefined} onSubmit={(reason) => reject.mutate({ id: d.id, reason }, { onSuccess: done(t('reject.done')) })} onClose={close} />}
      {dialog === 'replacement' && <TextDialog title={t('replacement.title')} hint={t('replacement.hint')} label={t('fields.reason')} submitLabel={t('actions.requestReplacement')} pending={replacement.isPending} error={replacement.isError ? errorText(t, tCommon, replacement.error) : undefined} onSubmit={(reason) => replacement.mutate({ id: d.id, reason }, { onSuccess: done(t('replacement.done')) })} onClose={close} />}
      {dialog === 'archive' && <TextDialog title={t('archive.title', { name: d.name })} hint={t('archive.hint')} label={t('fields.reason')} submitLabel={t('actions.archive')} pending={archive.isPending} error={archive.isError ? errorText(t, tCommon, archive.error) : undefined} onSubmit={(reason) => archive.mutate({ id: d.id, reason }, { onSuccess: done(t('archive.done')) })} onClose={close} />}
      {dialog === 'note' && <TextDialog title={t('note.title')} hint={t('note.hint')} label={t('fields.note')} submitLabel={t('actions.addNote')} pending={note.isPending} error={note.isError ? errorText(t, tCommon, note.error) : undefined} onSubmit={(text) => note.mutate({ id: d.id, text }, { onSuccess: done(t('note.done')) })} onClose={close} />}
    </>
  );
}
