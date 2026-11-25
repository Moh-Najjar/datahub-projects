import { useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import IconButton from '@mui/material/IconButton';
import LinearProgress from '@mui/material/LinearProgress';
import Link from '@mui/material/Link';
import Paper from '@mui/material/Paper';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TablePagination from '@mui/material/TablePagination';
import TableRow from '@mui/material/TableRow';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import MailOutlineIcon from '@mui/icons-material/EmailOutlined';
import ReplyOutlinedIcon from '@mui/icons-material/ReplyOutlined';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import type { AdminInquiry } from '@/core/api/contact';
import { useAdminInquiries } from '@/core/hooks/useAdminInquiries';
import { ADMIN_TEXT } from '@/modules/admin/data/adminText';
import { useCanViewInquiries } from '@/modules/admin/hooks/useBlogPermissions';
import { adminErrorMessage } from '@/modules/admin/utils/apiErrors';
import { formatAdminDate } from '@/modules/admin/utils/date';
import { AdminPageHeader } from './components/AdminPageHeader';
import { PageLoading } from './components/PageLoading';

const T = ADMIN_TEXT.inquiries;

/** The inquiry type as a tonal pill (one colour per type, the same in the list and the dialog). */
function TypeChip({ type }: { type: string }) {
  const key = type.toLowerCase();
  const color = key.includes('security') ? 'error' : key.includes('infrastructure') ? 'info' : key.includes('analytics') ? 'primary' : 'default';
  return type ? <Chip size="small" color={color} label={type} /> : <Typography component="span" variant="body2" color="text.secondary">—</Typography>;
}

const replyHref = (inquiry: AdminInquiry) => `mailto:${inquiry.email}?subject=${encodeURIComponent(T.replySubject(inquiry.inquiryType))}`;

/** One received inquiry in full, with "Reply by email". */
function InquiryDialog({ inquiry, onClose }: { inquiry: AdminInquiry; onClose: () => void }) {
  const fact = (label: string, value: React.ReactNode) => (
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '130px 1fr' }, gap: { xs: 0.25, sm: 2 }, py: 1 }}>
      <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>
        {label}
      </Typography>
      <Box sx={{ minWidth: 0, overflowWrap: 'anywhere' }}>{value}</Box>
    </Box>
  );
  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="sm" aria-labelledby="inquiry-title">
      <DialogTitle id="inquiry-title">{T.details}</DialogTitle>
      <DialogContent dividers>
        {fact(T.fields.from, <Typography sx={{ fontWeight: 600 }}>{inquiry.name || '—'}</Typography>)}
        {fact(T.fields.email, inquiry.email ? <Link href={`mailto:${inquiry.email}`}>{inquiry.email}</Link> : '—')}
        {fact(T.fields.about, <TypeChip type={inquiry.inquiryType} />)}
        {fact(T.fields.received, inquiry.receivedAtUtc ? <time dateTime={inquiry.receivedAtUtc}>{formatAdminDate(inquiry.receivedAtUtc)} UTC</time> : T.unknownDate)}
        {inquiry.status && fact(T.fields.status, inquiry.status)}
        <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600, mt: 1.5, mb: 1 }}>
          {T.fields.message}
        </Typography>
        <Box sx={{ p: 2, borderRadius: 1.25, bgcolor: 'grey.50', border: 1, borderColor: 'divider', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{inquiry.message || T.noMessage}</Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose}>{T.close}</Button>
        {inquiry.email && (
          <Button variant="contained" startIcon={<ReplyOutlinedIcon />} href={replyHref(inquiry)}>
            {T.reply}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}

/**
 * `/admin/inquiries/` — the inquiries sent through the website's contact and "Book appointment" forms
 * (`GET /api/v1/admin/contact/inquiries`, paged on the server). Read-only: open one to read it and reply by email.
 * Needs `crm.inquiries.view` (or `.manage`); the backend authorises the request itself.
 */
export default function AdminInquiriesPage() {
  const canView = useCanViewInquiries();
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(20);
  const [open, setOpen] = useState<AdminInquiry | null>(null);
  const list = useAdminInquiries({ pageNumber: page + 1, pageSize: rowsPerPage }, canView);
  const rows = list.data?.items ?? [];

  return (
    <>
      <title>{ADMIN_TEXT.pageTitle(T.title)}</title>
      <AdminPageHeader title={T.title} subtitle={T.subtitle} />

      {!canView ? (
        <Alert severity="info">{T.noAccess}</Alert>
      ) : (
        <>
          {list.data && (
            <Paper variant="outlined" sx={{ p: { xs: 2.5, md: 3 }, mb: 3.5, maxWidth: { sm: 320 } }}>
              <Typography color="text.secondary" sx={{ fontSize: 14, fontWeight: 500 }}>
                {T.total}
              </Typography>
              <Typography sx={{ mt: 1, fontSize: { xs: 30, md: 34 }, fontWeight: 800, lineHeight: 1.1, letterSpacing: '-0.03em', fontVariantNumeric: 'tabular-nums' }}>{list.data.totalCount}</Typography>
            </Paper>
          )}

          <Paper variant="outlined" sx={{ overflow: 'hidden', position: 'relative' }}>
            {list.isFetching && list.data && <LinearProgress aria-label={T.loading} sx={{ position: 'absolute', left: 0, right: 0, top: 0, height: 2 }} />}
            {list.status === 'pending' ? (
              <PageLoading />
            ) : list.status === 'error' && !list.data ? (
              <Alert severity="error" sx={{ m: 2 }} action={<Button color="inherit" onClick={() => void list.refetch()}>{T.retry}</Button>}>
                {T.loadError} {adminErrorMessage(list.error)}
              </Alert>
            ) : rows.length === 0 ? (
              <Box sx={{ display: 'grid', justifyItems: 'center', gap: '8px', px: '24px', py: '48px', textAlign: 'center' }}>
                <MailOutlineIcon sx={{ fontSize: 32, color: 'text.secondary' }} />
                <Typography color="text.secondary">{T.empty}</Typography>
              </Box>
            ) : (
              <>
                <TableContainer>
                  <Table aria-label={T.title} sx={{ minWidth: 760 }}>
                    <TableHead>
                      <TableRow sx={{ '& th': { whiteSpace: 'nowrap' } }}>
                        <TableCell sx={{ width: 170 }}>{T.columns.received}</TableCell>
                        <TableCell sx={{ width: 240 }}>{T.columns.from}</TableCell>
                        <TableCell sx={{ width: 190 }}>{T.columns.about}</TableCell>
                        <TableCell>{T.columns.message}</TableCell>
                        <TableCell align="right" sx={{ width: 110 }}>
                          {T.columns.actions}
                        </TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {rows.map((inquiry) => (
                        <TableRow key={inquiry.id} hover onClick={() => setOpen(inquiry)} sx={{ cursor: 'pointer' }}>
                          <TableCell sx={{ whiteSpace: 'nowrap' }}>
                            {inquiry.receivedAtUtc ? (
                              <time dateTime={inquiry.receivedAtUtc}>{formatAdminDate(inquiry.receivedAtUtc)}</time>
                            ) : (
                              <Typography component="span" variant="body2" color="text.secondary">
                                {T.unknownDate}
                              </Typography>
                            )}
                          </TableCell>
                          <TableCell>
                            <Typography sx={{ fontWeight: 600, lineHeight: 1.45 }}>{inquiry.name || '—'}</Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ wordBreak: 'break-all' }}>
                              {inquiry.email}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <TypeChip type={inquiry.inquiryType} />
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2" sx={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', overflowWrap: 'anywhere', color: inquiry.message ? 'text.primary' : 'text.secondary' }}>
                              {inquiry.message || T.noMessage}
                            </Typography>
                          </TableCell>
                          <TableCell align="right" sx={{ whiteSpace: 'nowrap' }} onClick={(e) => e.stopPropagation()}>
                            <Tooltip title={T.view}>
                              <IconButton onClick={() => setOpen(inquiry)} aria-label={`${T.view}: ${inquiry.name || inquiry.email}`}>
                                <VisibilityOutlinedIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            {inquiry.email && (
                              <Tooltip title={T.reply}>
                                <IconButton component="a" href={replyHref(inquiry)} aria-label={`${T.reply}: ${inquiry.name || inquiry.email}`}>
                                  <ReplyOutlinedIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
                <TablePagination
                  component="div"
                  count={list.data?.totalCount ?? 0}
                  page={Math.min(page, Math.max(0, (list.data?.totalPages ?? 1) - 1))}
                  onPageChange={(_, p) => setPage(p)}
                  rowsPerPage={rowsPerPage}
                  onRowsPerPageChange={(e) => {
                    setRowsPerPage(Number(e.target.value));
                    setPage(0);
                  }}
                  rowsPerPageOptions={[10, 20, 50, 100]}
                  labelRowsPerPage={T.rowsPerPage}
                />
              </>
            )}
          </Paper>
        </>
      )}

      {open && <InquiryDialog inquiry={open} onClose={() => setOpen(null)} />}
    </>
  );
}
