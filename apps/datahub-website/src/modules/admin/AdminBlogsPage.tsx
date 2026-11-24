import { useEffect, useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import LinearProgress from '@mui/material/LinearProgress';
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
import type { BlogListItem } from '@/core/types/blog';
import type { BlogStatus } from '@/core/types/enums/blogStatus';
import { useAdminBlogs, useDeleteBlog, useSetBlogStatus } from '@/core/hooks/useAdminBlogs';
import { ADMIN_ROUTES } from '@/core/routes/paths';
import { ADMIN_TEXT } from '@/modules/admin/data/adminText';
import { toStatus } from '@/modules/admin/schemas/blogPostSchema';
import { adminErrorMessage } from '@/modules/admin/utils/apiErrors';
import { formatAdminDate } from '@/modules/admin/utils/date';
import { useBlogPermissions } from '@/modules/admin/hooks/useBlogPermissions';
import type { SavedNotice } from './components/BlogForm';
import { AdminPageHeader } from './components/AdminPageHeader';
import { ConfirmDialog } from './components/ConfirmDialog';
import { PageLoading } from './components/PageLoading';
import { StatusChip } from './components/StatusChip';

const T = ADMIN_TEXT.list;
const SEARCH_DELAY_MS = 300;

type Feedback = { text: string; severity: 'success' | 'warning' | 'error' } | null;

/** The value, once it has stopped changing for `delay` ms (search as you type without a request per key). */
function useDebounced<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

/**
 * `/admin/blogs/` — every blog post of the backend (published and drafts). Search, status filter and paging run on
 * the server (`GET /api/admin/blogs`); publish / unpublish / delete use the post's current `rowVersion`.
 */
export default function AdminBlogsPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'' | BlogStatus>('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [toDelete, setToDelete] = useState<BlogListItem | null>(null);
  const debouncedSearch = useDebounced(search.trim(), SEARCH_DELAY_MS);

  const list = useAdminBlogs({ pageNumber: page + 1, pageSize: rowsPerPage, search: debouncedSearch || undefined, status: status || undefined });
  // Totals for the summary (one post per request: only `totalCount` is used).
  const all = useAdminBlogs({ pageNumber: 1, pageSize: 1 });
  const published = useAdminBlogs({ pageNumber: 1, pageSize: 1, status: 'Published' });
  const drafts = useAdminBlogs({ pageNumber: 1, pageSize: 1, status: 'Draft' });
  const totals = all.data && published.data && drafts.data ? { all: all.data.totalCount, published: published.data.totalCount, drafts: drafts.data.totalCount } : null;

  const can = useBlogPermissions();
  const setPostStatus = useSetBlogStatus();
  const deletePost = useDeleteBlog();

  // Confirmation passed by the editor after saving: shown once, then removed from the history entry.
  const notice = (location.state as { notice?: SavedNotice } | null)?.notice;
  const [feedback, setFeedback] = useState<Feedback>(() => notice ?? null);
  useEffect(() => {
    if (notice) navigate(location.pathname, { replace: true, state: null });
  }, [notice, navigate, location.pathname]);

  const totalPages = list.data?.totalPages ?? 0;

  const toggleStatus = (item: BlogListItem) => {
    const next: BlogStatus = toStatus(item.status) === 'Published' ? 'Draft' : 'Published';
    setPostStatus.mutate(
      { id: item.id, status: next },
      {
        onSuccess: () => setFeedback({ text: next === 'Published' ? T.published(item.title) : T.unpublished(item.title), severity: 'success' }),
        onError: (e) => setFeedback({ text: adminErrorMessage(e), severity: 'error' }),
      },
    );
  };

  const confirmDelete = () => {
    if (!toDelete) return;
    deletePost.mutate(
      { id: toDelete.id },
      {
        onSuccess: () => {
          setFeedback({ text: T.deleted(toDelete.title), severity: 'success' });
          setToDelete(null);
          // The last post of the last page is gone: show the page before it.
          if (rows.length === 1 && page > 0) setPage(page - 1);
        },
        onError: (e) => setFeedback({ text: adminErrorMessage(e), severity: 'error' }),
      },
    );
  };

  const rows = list.data?.items ?? [];
  const filtering = Boolean(debouncedSearch || status);
  const busyId = setPostStatus.isPending ? setPostStatus.variables.id : null;

  return (
    <>
      <title>{ADMIN_TEXT.pageTitle(T.title)}</title>
      <AdminPageHeader
        title={T.title}
        subtitle={T.subtitle}
        actions={
          can.create ? (
            <Button component={RouterLink} to={ADMIN_ROUTES.newBlog} variant="contained" startIcon={<AddIcon />}>
              {T.newPost}
            </Button>
          ) : undefined
        }
      />

      {totals && (
        <Box component="ul" aria-label={T.counts(totals.all, totals.published, totals.drafts)} sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, minmax(0, 1fr))' }, gap: '12px', mb: '16px', p: 0, m: 0, listStyle: 'none' }}>
          {(
            [
              [T.metrics.total, totals.all],
              [T.metrics.published, totals.published],
              [T.metrics.drafts, totals.drafts],
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

      <Paper variant="outlined" sx={{ overflow: 'hidden', position: 'relative' }}>
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
            <MenuItem value="Published">{ADMIN_TEXT.status.published}</MenuItem>
            <MenuItem value="Draft">{ADMIN_TEXT.status.draft}</MenuItem>
          </TextField>
          {list.data && (
            <Typography variant="body2" color="text.secondary" sx={{ ml: { md: 'auto' } }} aria-live="polite">
              {filtering ? T.matches(list.data.totalCount) : totals ? T.counts(totals.all, totals.published, totals.drafts) : ''}
            </Typography>
          )}
        </Box>
        {list.isFetching && list.data && <LinearProgress aria-label={T.searching} sx={{ position: 'absolute', left: 0, right: 0, height: 2 }} />}

        {list.status === 'pending' ? (
          <PageLoading />
        ) : list.status === 'error' && !list.data ? (
          <Alert severity="error" sx={{ m: 2 }} action={<Button color="inherit" onClick={() => void list.refetch()}>{T.retry}</Button>}>
            {T.loadError} {adminErrorMessage(list.error)}
          </Alert>
        ) : rows.length === 0 ? (
          <Box sx={{ display: 'grid', justifyItems: 'center', gap: '8px', px: '24px', py: '48px', textAlign: 'center' }}>
            <ArticleOutlinedIcon sx={{ fontSize: 32, color: 'text.secondary' }} />
            <Typography color="text.secondary">{filtering ? T.noMatches : T.empty}</Typography>
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
                    const busy = busyId === item.id;
                    const isPublished = toStatus(item.status) === 'Published';
                    const toggleLabel = isPublished ? T.actions.unpublish : T.actions.publish;
                    return (
                      <TableRow key={item.id} hover>
                        <TableCell>
                          {item.featuredImageUrl ? (
                            <Box component="img" src={item.featuredImageUrl} alt="" loading="lazy" width={80} height={45} sx={{ width: 80, height: 45, objectFit: 'cover', borderRadius: '6px', bgcolor: 'background.default' }} />
                          ) : (
                            <Box title={T.noCover} sx={{ width: 80, height: 45, display: 'grid', placeItems: 'center', borderRadius: '6px', bgcolor: 'background.default', color: 'text.secondary' }}>
                              <ImageNotSupportedOutlinedIcon fontSize="small" aria-label={T.noCover} />
                            </Box>
                          )}
                        </TableCell>
                        <TableCell sx={{ minWidth: 240 }}>
                          {can.update ? (
                            <Box component={RouterLink} to={ADMIN_ROUTES.editBlog(item.id)} sx={{ color: 'text.primary', fontWeight: 600, lineHeight: 1.45, display: 'block', '&:hover': { color: 'primary.main' } }}>
                              {item.title}
                            </Box>
                          ) : (
                            <Typography sx={{ color: 'text.primary', fontWeight: 600, lineHeight: 1.45 }}>{item.title}</Typography>
                          )}
                          <Typography variant="body2" color="text.secondary" sx={{ fontFamily: 'monospace', fontSize: 12, wordBreak: 'break-all' }}>
                            /{item.slug}/
                          </Typography>
                        </TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>
                          {item.publishedAtUtc ? (
                            <time dateTime={item.publishedAtUtc}>{formatAdminDate(item.publishedAtUtc)}</time>
                          ) : (
                            <Typography component="span" variant="body2" color="text.secondary">
                              {T.notPublished}
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell>
                          <StatusChip status={item.status} />
                        </TableCell>
                        <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                          {can.publish && (
                            <Tooltip title={toggleLabel}>
                              <span>
                                <IconButton onClick={() => toggleStatus(item)} disabled={busy} aria-label={`${toggleLabel}: ${item.title}`}>
                                  {isPublished ? <UnpublishedOutlinedIcon fontSize="small" /> : <PublishOutlinedIcon fontSize="small" />}
                                </IconButton>
                              </span>
                            </Tooltip>
                          )}
                          <Tooltip title={T.actions.view}>
                            <span>
                              <IconButton component="a" href={`/${item.slug}/`} target="_blank" rel="noopener" disabled={!isPublished} aria-label={`${T.actions.view}: ${item.title}`}>
                                <OpenInNewOutlinedIcon fontSize="small" />
                              </IconButton>
                            </span>
                          </Tooltip>
                          {can.update && (
                            <Tooltip title={T.actions.edit}>
                              <IconButton component={RouterLink} to={ADMIN_ROUTES.editBlog(item.id)} aria-label={`${T.actions.edit}: ${item.title}`}>
                                <EditOutlinedIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          )}
                          {can.delete && (
                            <Tooltip title={T.actions.delete}>
                              <IconButton onClick={() => setToDelete(item)} aria-label={`${T.actions.delete}: ${item.title}`} sx={{ '&:hover': { color: 'error.main' } }}>
                                <DeleteOutlineIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
            <TablePagination
              component="div"
              count={list.data?.totalCount ?? 0}
              page={Math.min(page, Math.max(0, totalPages - 1))}
              onPageChange={(_, p) => setPage(p)}
              rowsPerPage={rowsPerPage}
              onRowsPerPageChange={(e) => {
                setRowsPerPage(Number(e.target.value));
                setPage(0);
              }}
              rowsPerPageOptions={[10, 25, 50, 100]}
              labelRowsPerPage={T.rowsPerPage}
            />
          </>
        )}
      </Paper>

      <ConfirmDialog
        open={Boolean(toDelete)}
        title={T.deleteTitle}
        text={toDelete ? T.deleteText(toDelete.title) : ''}
        confirmLabel={T.deleteConfirm}
        cancelLabel={T.cancel}
        danger
        pending={deletePost.isPending}
        onConfirm={confirmDelete}
        onCancel={() => setToDelete(null)}
      />
      <Snackbar open={Boolean(feedback)} autoHideDuration={feedback?.severity === 'success' ? 5000 : 9000} onClose={() => setFeedback(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        {feedback ? (
          <Alert severity={feedback.severity} variant="filled" onClose={() => setFeedback(null)}>
            {feedback.text}
          </Alert>
        ) : undefined}
      </Snackbar>
    </>
  );
}
