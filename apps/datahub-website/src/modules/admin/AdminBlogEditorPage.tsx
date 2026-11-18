import { useCallback, useEffect, useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import OpenInNewOutlinedIcon from '@mui/icons-material/OpenInNewOutlined';
import { Link as RouterLink, useNavigate, useParams } from 'react-router-dom';
import { ADMIN_ROUTES } from '@/core/routes/paths';
import { BlogApiError, createPost, getPostById, updatePost, type BlogPost, type BlogPostInput } from '@/modules/blog';
import { ADMIN_TEXT } from '@/modules/admin/data/adminText';
import { emptyFormValues, toFormValues } from '@/modules/admin/schemas/blogPostSchema';
import { BlogForm } from './components/BlogForm';
import { PageLoading } from './components/PageLoading';
import { StatusChip } from './components/StatusChip';

const E = ADMIN_TEXT.editor;

type Loaded = { kind: 'loading' } | { kind: 'ready'; post: BlogPost | null } | { kind: 'error'; notFound: boolean };

/** `/admin/blogs/new/` and `/admin/blogs/:postId/edit/` — create or edit a blog post. */
export default function AdminBlogEditorPage() {
  const { postId } = useParams();
  const navigate = useNavigate();
  const isNew = !postId;
  const [loaded, setLoaded] = useState<Loaded>(isNew ? { kind: 'ready', post: null } : { kind: 'loading' });

  useEffect(() => {
    if (!postId) return;
    let active = true;
    getPostById(postId).then(
      (post) => active && setLoaded({ kind: 'ready', post }),
      (e: unknown) => active && setLoaded({ kind: 'error', notFound: e instanceof BlogApiError && e.code === 'not-found' }),
    );
    return () => {
      active = false;
    };
  }, [postId]);

  const save = async (input: BlogPostInput) => {
    const post = postId ? await updatePost(postId, input) : await createPost(input);
    return postId ? E.saved(post.summary.title) : E.created(post.summary.title);
  };
  const onSaved = useCallback((notice: string) => navigate(ADMIN_ROUTES.blogs, { state: { notice } }), [navigate]);

  const post = loaded.kind === 'ready' ? loaded.post : null;
  const heading = isNew ? E.newTitle : E.editTitle;

  return (
    <>
      <title>{ADMIN_TEXT.pageTitle(heading)}</title>
      <Button component={RouterLink} to={ADMIN_ROUTES.blogs} startIcon={<ArrowBackIcon />} sx={{ height: 36, px: 1, mb: '12px', color: 'text.secondary' }}>
        {E.back}
      </Button>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '12px', mb: '20px' }}>
        <Typography variant="h1" sx={{ fontSize: { xs: 26, md: 30 }, fontWeight: 700, letterSpacing: '-0.02em', color: 'text.primary' }}>
          {heading}
        </Typography>
        {post && <StatusChip status={post.status} />}
        {post?.status === 'published' && (
          <Button component="a" href={`/${post.summary.slug}/`} target="_blank" rel="noopener" startIcon={<OpenInNewOutlinedIcon />} sx={{ height: 36, px: 1.5, ml: { sm: 'auto' } }}>
            {E.viewOnSite}
          </Button>
        )}
      </Box>

      {loaded.kind === 'loading' && <PageLoading />}
      {loaded.kind === 'error' && <Alert severity={loaded.notFound ? 'warning' : 'error'}>{loaded.notFound ? E.notFound : E.loadError}</Alert>}
      {loaded.kind === 'ready' && (
        <BlogForm key={post?.id ?? 'new'} isNew={isNew} defaultValues={post ? toFormValues(post) : emptyFormValues()} onSubmit={save} onSaved={onSaved} onCancel={() => navigate(ADMIN_ROUTES.blogs)} />
      )}
    </>
  );
}
