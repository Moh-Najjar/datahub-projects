import { useEffect, useMemo, useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Snackbar from '@mui/material/Snackbar';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TablePagination from '@mui/material/TablePagination';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import AddIcon from '@mui/icons-material/Add';
import ArticleOutlinedIcon from '@mui/icons-material/ArticleOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import ImageNotSupportedOutlinedIcon from '@mui/icons-material/ImageNotSupportedOutlined';
import OpenInNewOutlinedIcon from '@mui/icons-material/OpenInNewOutlined';
import SearchIcon from '@mui/icons-material/Search';
import UnpublishedOutlinedIcon from '@mui/icons-material/UnpublishedOutlined';
import PublishOutlinedIcon from '@mui/icons-material/PublishOutlined';
import { Link as RouterLink, useLocation, useNavigate } from 'react-router-dom';
import { ADMIN_ROUTES } from '@/core/routes/paths';
import { BlogApiError, deletePost, setPostStatus, type BlogPostListItem, type BlogStatus } from '@/modules/blog';
import { ADMIN_TEXT } from '@/modules/admin/data/adminText';
import { useAdminPosts } from '@/modules/admin/hooks/useAdminPosts';
import { formatAdminDate } from '@/modules/admin/utils/date';
import { ConfirmDialog } from './components/ConfirmDialog';
import { PageLoading } from './components/PageLoading';
import { StatusChip } from './components/StatusChip';

const T = ADMIN_TEXT.list;

type Feedback = { text: string; severity: 'success' | 'error' } | null;

const errorText = (e: unknown) => (e instanceof BlogApiError && e.code === 'storage-full' ? ADMIN_TEXT.validation.storageFull : ADMIN_TEXT.validation.generic);

/** `/admin/blogs/` — every blog post with search, status filter, paging and actions. */
export default function AdminBlogsPage() {
  const { posts, isLoading, error, reload } = useAdminPosts();
  const location = useLocation();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'' | BlogStatus>('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [toDelete, setToDelete] = useState<BlogPostListItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  // Confirmation passed by the editor after saving: shown once, then removed from the history entry.
  const notice = (location.state as { notice?: string } | null)?.notice;
  const [feedback, setFeedback] = useState<Feedback>(() => (notice ? { text: notice, severity: 'success' } : null));
  useEffect(() => {
    if (notice) navigate(location.pathname, { replace: true, state: null });
  }, [notice, navigate, location.pathname]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return posts.filter((p) => (!status || p.status === status) && (!q || p.summary.title.toLowerCase().includes(q) || p.summary.slug.includes(q)));
  }, [posts, search, status]);
  const published = posts.filter((p) => p.status === 'published').length;
  const lastPage = Math.max(0, Math.ceil(filtered.length / rowsPerPage) - 1);
  const currentPage = Math.min(page, lastPage);
  const rows = filtered.slice(currentPage * rowsPerPage, currentPage * rowsPerPage + rowsPerPage);

  const toggleStatus = async (item: BlogPostListItem) => {
    const next: BlogStatus = item.status === 'published' ? 'draft' : 'published';
    setBusyId(item.id);
    try {
      await setPostStatus(item.id, next);
      setFeedback({ text: next === 'published' ? T.published(item.summary.title) : T.unpublished(item.summary.title), severity: 'success' });
    } catch (e) {
      setFeedback({ text: errorText(e), severity: 'error' });
    } finally {
      setBusyId(null);
    }
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await deletePost(toDelete.id);
      setFeedback({ text: T.deleted(toDelete.summary.title), severity: 'success' });
      setToDelete(null);
    } catch (e) {
      setFeedback({ text: errorText(e), severity: 'error' });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <title>{ADMIN_TEXT.pageTitle(T.title)}</title>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: '16px', mb: '20px' }}>
        <Box>
          <Typography variant="h1" sx={{ fontSize: { xs: 26, md: 30 }, fontWeight: 700, letterSpacing: '-0.02em', color: 'text.primary' }}>
            {T.title}
          </Typography>
          <Typography color="text.secondary" sx={{ mt: '4px', maxWidth: 640 }}>
            {T.subtitle}
          </Typography>
        </Box>
        <Button component={RouterLink} to={ADMIN_ROUTES.newBlog} variant="contained" startIcon={<AddIcon />} sx={{ height: 40, px: 2 }}>
          {T.newPost}
        </Button>
      </Box>

      {!isLoading && !error && (
        <Box component="ul" aria-label={T.counts(posts.length, published, posts.length - published)} sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, minmax(0, 1fr))' }, gap: '12px', mb: '16px', p: 0, m: 0, listStyle: 'none' }}>
          {(
            [
              [T.metrics.total, posts.length],
              [T.metrics.published, published],
              [T.metrics.drafts, posts.length - published],
            ] as const
          ).map(([label, value]) => (
            <Paper key={label} component="li" variant="outlined" sx={{ px: '16px', py: '14px' }}>
              <Typography variant="body2" color="text.secondary">
                {label}
              </Typography>
              <Typography sx={{ mt: '2px', fontSize: 26, fontWeight: 700, lineHeight: 1.2, color: 'text.primary' }}>{value}</Typography>
            </Paper>
          ))}
        </Box>
      )}

      <Paper variant="outlined" sx={{ overflow: 'hidden' }}>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center', p: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
          <TextField
            type="search"
            size="small"
            label={T.search}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
            sx={{ flex: '1 1 260px', maxWidth: { sm: 420 } }}
            slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> } }}
          />
          <TextField
            select
            size="small"
            label={T.status}
            value={status}
            onChange={(e) => {
              setStatus(e.target.value as '' | BlogStatus);
              setPage(0);
            }}
            sx={{ flex: '0 1 200px', minWidth: 160 }}
          >
            <MenuItem value="">{T.allStatuses}</MenuItem>
            <MenuItem value="published">{ADMIN_TEXT.status.published}</MenuItem>
            <MenuItem value="draft">{ADMIN_TEXT.status.draft}</MenuItem>
          </TextField>
          {!isLoading && !error && (
            <Typography variant="body2" color="text.secondary" sx={{ ml: { md: 'auto' } }} aria-live="polite">
              {T.counts(posts.length, published, posts.length - published)}
            </Typography>
          )}
        </Box>

        {isLoading ? (
          <PageLoading />
        ) : error ? (
          <Alert severity="error" sx={{ m: 2 }} action={<Button color="inherit" onClick={reload}>{T.retry}</Button>}>
            {T.loadError}
          </Alert>
        ) : filtered.length === 0 ? (
          <Box sx={{ display: 'grid', justifyItems: 'center', gap: '8px', px: '24px', py: '48px', textAlign: 'center' }}>
            <ArticleOutlinedIcon sx={{ fontSize: 32, color: 'text.secondary' }} />
            <Typography color="text.secondary">{posts.length === 0 ? T.empty : T.noMatches}</Typography>
          </Box>
        ) : (
          <>
            <TableContainer>
              <Table aria-label={T.title} sx={{ minWidth: 720 }}>
                <TableHead>
                  <TableRow sx={{ '& th': { whiteSpace: 'nowrap' } }}>
                    <TableCell sx={{ width: 104 }}>{T.columns.cover}</TableCell>
                    <TableCell>{T.columns.title}</TableCell>
                    <TableCell sx={{ width: 170 }}>{T.columns.date}</TableCell>
                    <TableCell sx={{ width: 120 }}>{T.columns.status}</TableCell>
                    <TableCell align="right" sx={{ width: 180 }}>
                      {T.columns.actions}
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rows.map((item) => {
                    const p = item.summary;
                    const busy = busyId === item.id;
                    return (
                      <TableRow key={item.id} hover>
                        <TableCell>
                          {p.image ? (
                            <Box component="img" src={p.image.card} alt="" loading="lazy" width={80} height={45} sx={{ width: 80, height: 45, objectFit: 'cover', borderRadius: '6px', bgcolor: 'background.default' }} />
                          ) : (
                            <Box title={T.noCover} sx={{ width: 80, height: 45, display: 'grid', placeItems: 'center', borderRadius: '6px', bgcolor: 'background.default', color: 'text.secondary' }}>
                              <ImageNotSupportedOutlinedIcon fontSize="small" aria-label={T.noCover} />
                            </Box>
                          )}
                        </TableCell>
                        <TableCell sx={{ minWidth: 240 }}>
                          <Box component={RouterLink} to={ADMIN_ROUTES.editBlog(item.id)} sx={{ color: 'text.primary', fontWeight: 600, lineHeight: 1.45, display: 'block', '&:hover': { color: 'primary.main' } }}>
                            {p.title}
                          </Box>
                          <Typography variant="body2" color="text.secondary" sx={{ fontFamily: 'monospace', fontSize: 12, wordBreak: 'break-all' }}>
                            /{p.slug}/
                          </Typography>
                        </TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>
                          <time dateTime={p.date}>{formatAdminDate(p.date)}</time>
                        </TableCell>
                        <TableCell>
                          <StatusChip status={item.status} />
                        </TableCell>
                        <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                          <Tooltip title={item.status === 'published' ? T.actions.unpublish : T.actions.publish}>
                            <span>
                              <IconButton onClick={() => void toggleStatus(item)} disabled={busy} aria-label={`${item.status === 'published' ? T.actions.unpublish : T.actions.publish}: ${p.title}`}>
                                {item.status === 'published' ? <UnpublishedOutlinedIcon fontSize="small" /> : <PublishOutlinedIcon fontSize="small" />}
                              </IconButton>
                            </span>
                          </Tooltip>
                          <Tooltip title={T.actions.view}>
                            <span>
                              <IconButton component="a" href={`/${p.slug}/`} target="_blank" rel="noopener" disabled={item.status !== 'published'} aria-label={`${T.actions.view}: ${p.title}`}>
                                <OpenInNewOutlinedIcon fontSize="small" />
                              </IconButton>
                            </span>
                          </Tooltip>
                          <Tooltip title={T.actions.edit}>
                            <IconButton component={RouterLink} to={ADMIN_ROUTES.editBlog(item.id)} aria-label={`${T.actions.edit}: ${p.title}`}>
                              <EditOutlinedIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title={T.actions.delete}>
                            <IconButton onClick={() => setToDelete(item)} aria-label={`${T.actions.delete}: ${p.title}`} sx={{ '&:hover': { color: 'error.main' } }}>
                              <DeleteOutlineIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
            <TablePagination
              component="div"
              count={filtered.length}
              page={currentPage}
              onPageChange={(_, p) => setPage(p)}
              rowsPerPage={rowsPerPage}
              onRowsPerPageChange={(e) => {
                setRowsPerPage(Number(e.target.value));
                setPage(0);
              }}
              rowsPerPageOptions={[10, 25, 50]}
              labelRowsPerPage={T.rowsPerPage}
            />
          </>
        )}
      </Paper>

      <ConfirmDialog
        open={Boolean(toDelete)}
        title={T.deleteTitle}
        text={toDelete ? T.deleteText(toDelete.summary.title) : ''}
        confirmLabel={T.deleteConfirm}
        cancelLabel={T.cancel}
        danger
        pending={deleting}
        onConfirm={() => void confirmDelete()}
        onCancel={() => setToDelete(null)}
      />
      <Snackbar open={Boolean(feedback)} autoHideDuration={5000} onClose={() => setFeedback(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        {feedback ? (
          <Alert severity={feedback.severity} variant="filled" onClose={() => setFeedback(null)}>
            {feedback.text}
          </Alert>
        ) : undefined}
      </Snackbar>
    </>
  );
}
