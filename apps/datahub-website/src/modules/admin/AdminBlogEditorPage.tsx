import { useCallback, useState } from 'react';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import OpenInNewOutlinedIcon from '@mui/icons-material/OpenInNewOutlined';
import { Link as RouterLink, useNavigate, useParams } from 'react-router-dom';
import { BlogStatusNotChangedError, isAdminBlogNotFound, useAdminBlog, useSaveBlog } from '@/core/hooks/useAdminBlogs';
import { ADMIN_ROUTES } from '@/core/routes/paths';
import { ADMIN_TEXT } from '@/modules/admin/data/adminText';
import { emptyFormValues, toFormValues, toStatus, toWriteBody, type BlogPostFormValues } from '@/modules/admin/schemas/blogPostSchema';
import { adminErrorMessage } from '@/modules/admin/utils/apiErrors';
import { useBlogPermissions } from '@/modules/admin/hooks/useBlogPermissions';
import { AdminPageHeader } from './components/AdminPageHeader';
import { BlogForm, type BlogFormBase, type SavedNotice } from './components/BlogForm';
import { PageLoading } from './components/PageLoading';
import { StatusChip } from './components/StatusChip';

const E = ADMIN_TEXT.editor;

/**
 * `/admin/blogs/new/` and `/admin/blogs/:postId/edit/` — create or edit a blog post in the backend. Editing loads the
 * post's latest version (with its `rowVersion`); saving sends that `rowVersion`, so a change made meanwhile by someone
 * else is reported (conflict) instead of being overwritten.
 */
export default function AdminBlogEditorPage() {
  const { postId } = useParams();
  const navigate = useNavigate();
  const isNew = !postId;
  const can = useBlogPermissions();
  const allowed = isNew ? can.create : can.update;
  const { data: post, status, error, refetch, isRefetching } = useAdminBlog(allowed ? postId : undefined);
  const save = useSaveBlog();
  /** Bumped after loading the latest version (conflict): the form restarts from it. */
  const [formVersion, setFormVersion] = useState(0);
  const reloadLatest = async () => {
    await refetch();
    setFormVersion((v) => v + 1);
  };

  const submit = async (values: BlogPostFormValues, base: BlogFormBase | undefined): Promise<SavedNotice> => {
    const title = values.title.trim();
    const done = base ? E.saved(title) : E.created(title);
    try {
      await save.mutateAsync({ body: toWriteBody(values), status: values.status, existing: base });
    } catch (e) {
      // The content was saved; only publishing / unpublishing failed.
      if (e instanceof BlogStatusNotChangedError) return { text: `${done} ${E.statusNotChanged(e.status)}`, severity: 'warning' };
      throw e;
    }
    return { text: done, severity: 'success' };
  };
  const onSaved = useCallback((notice: SavedNotice) => navigate(ADMIN_ROUTES.blogs, { state: { notice } }), [navigate]);

  const heading = isNew ? E.newTitle : E.editTitle;
  const published = post ? toStatus(post.status) === 'Published' : false;

  return (
    <>
      <title>{ADMIN_TEXT.pageTitle(heading)}</title>
      <Button component={RouterLink} to={ADMIN_ROUTES.blogs} startIcon={<ArrowBackIcon />} sx={{ mb: 1.5, color: 'text.secondary' }}>
        {E.back}
      </Button>
      <AdminPageHeader
        title={heading}
        eyebrow={post ? <StatusChip status={post.status} /> : undefined}
        actions={
          post && published ? (
            <Button component="a" href={`/${post.slug}/`} target="_blank" rel="noopener" variant="outlined" startIcon={<OpenInNewOutlinedIcon />}>
              {E.viewOnSite}
            </Button>
          ) : undefined
        }
      />

      {!allowed ? (
        <Alert severity="warning">{isNew ? ADMIN_TEXT.validation.noCreate : ADMIN_TEXT.validation.noUpdate}</Alert>
      ) : isNew ? (
        <BlogForm key="new" isNew canPublish={can.publish} defaultValues={emptyFormValues()} onSubmit={submit} onSaved={onSaved} onCancel={() => navigate(ADMIN_ROUTES.blogs)} />
      ) : status === 'pending' || (isRefetching && !post) ? (
        <PageLoading />
      ) : status === 'error' && !post ? (
        <Alert severity={isAdminBlogNotFound(error) ? 'warning' : 'error'} action={!isAdminBlogNotFound(error) && <Button color="inherit" onClick={() => void refetch()}>{ADMIN_TEXT.list.retry}</Button>}>
          {isAdminBlogNotFound(error) ? E.notFound : `${E.loadError} ${adminErrorMessage(error)}`}
        </Alert>
      ) : post ? (
        // Reloading after a conflict gives a fresh form with the latest content (and rowVersion).
        <BlogForm
          key={`${post.id}:${formVersion}`}
          isNew={false}
          canPublish={can.publish}
          terms={{ categories: post.categories, tags: post.tags }}
          base={{ id: post.id, rowVersion: post.rowVersion, status: toStatus(post.status) }}
          defaultValues={toFormValues(post)}
          onSubmit={submit}
          onSaved={onSaved}
          onCancel={() => navigate(ADMIN_ROUTES.blogs)}
          onReloadLatest={() => void reloadLatest()}
        />
      ) : null}
    </>
  );
}
