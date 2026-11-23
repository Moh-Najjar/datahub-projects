import { useMemo } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import CalendarTodayOutlinedIcon from '@mui/icons-material/CalendarTodayOutlined';
import LocalOfferOutlinedIcon from '@mui/icons-material/LocalOfferOutlined';
import PersonOutlineOutlinedIcon from '@mui/icons-material/PersonOutlineOutlined';
import { useParams } from 'react-router-dom';
import { isBlogNotFound, useBlog } from '@/core/hooks/useBlogs';
import { UI } from '@/i18n';
import { useLocale } from '@/i18n/LocaleContext';
import { Seo, SITE_URL } from '@/modules/shared/Seo';
import { NotFoundPage } from '@/modules/errors';
import { PostNavigation } from '@/modules/blog/components/PostNavigation';
import { ShareButton } from '@/modules/blog/components/ShareButton';
import { articleSx } from '@/modules/blog/utils/articleStyles';
import { formatPostDate } from '@/modules/blog/utils/date';
import { sanitizeHtml } from '@/modules/blog/utils/sanitizeHtml';

/**
 * Single blog post (`/<slug>/`) from the backend (`GET /api/blogs/{slug}`). Unknown slugs and drafts answer 404 →
 * the site's 404 page. Only what the backend provides is shown: the categories (above the title), author, date, image and
 * tags (footer) are left out when missing. Footer: tags + "Share this post"; then the previous / next post (neighbours in
 * the blog's order, from the cached list of every published post).
 */
export default function BlogPostPage() {
  const { slug = '' } = useParams();
  const { locale } = useLocale();
  const t = UI[locale].blog;
  const { data: post, status, error, refetch } = useBlog(slug);
  // The article HTML comes from the backend: always sanitized before it is rendered.
  const html = useMemo(() => (post ? sanitizeHtml(post.contentHtml) : ''), [post]);

  if (status === 'pending') {
    return (
      <Box role="status" aria-label={t.loading} sx={{ minHeight: '60vh', display: 'grid', placeItems: 'center' }}>
        <CircularProgress size={32} thickness={3} />
      </Box>
    );
  }
  if (status === 'error') {
    if (isBlogNotFound(error)) return <NotFoundPage />;
    return (
      <Container sx={{ py: '120px' }}>
        <Alert severity="error" action={<Button color="inherit" onClick={() => void refetch()}>{t.retry}</Button>}>
          {t.postError}
        </Alert>
      </Container>
    );
  }

  const url = `${SITE_URL}/${post.slug}/`;

  return (
    <>
      <Seo
        title={post.metaTitle ?? `${post.title} Datahub Analytics`}
        description={post.metaDescription ?? post.excerpt ?? undefined}
        path={`/${post.slug}/`}
        canonicalUrl={post.canonicalUrl ?? undefined}
        image={post.featuredImageUrl ?? undefined}
        type="article"
        locales={['en']}
      />
      <Box component="article" dir="ltr" sx={{ pt: { xs: '60px', md: '120px' }, pb: '100px' }}>
        <Container>
          {post.featuredImageUrl && (
            <Box component="img" src={post.featuredImageUrl} alt={post.title} decoding="async" sx={{ display: 'block', width: '100%', height: 'auto', borderRadius: '5px' }} />
          )}
          <Box sx={{ maxWidth: 800, mx: 'auto', px: '15px', mt: '40px' }}>
            <Box component="header" sx={{ textAlign: 'center' }}>
              {post.categories.length > 0 && (
                <Typography sx={{ color: 'brand.green', fontSize: 14, fontWeight: 500, textTransform: 'uppercase', '& span + span::before': { content: '" | "', color: 'text.primary', mx: '6px' } }}>
                  {post.categories.map((c) => (
                    <span key={c.id}>{c.name}</span>
                  ))}
                </Typography>
              )}
              <Typography variant="h1" sx={{ mt: '12px', mb: '16px', fontSize: { xs: 28, md: 40 }, lineHeight: 1.4 }}>
                {post.title}
              </Typography>
              {(post.authorName || post.publishedAtUtc) && (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '8px 16px', fontSize: 14 }}>
                  {post.authorName && (
                    <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                      <PersonOutlineOutlinedIcon sx={{ fontSize: 16 }} />
                      {post.authorName}
                    </Box>
                  )}
                  {post.publishedAtUtc && (
                    <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                      <CalendarTodayOutlinedIcon sx={{ fontSize: 14 }} />
                      <time dateTime={post.publishedAtUtc}>{formatPostDate(post.publishedAtUtc, locale)}</time>
                    </Box>
                  )}
                </Box>
              )}
            </Box>

            <Box sx={{ mt: '50px', ...articleSx }} dangerouslySetInnerHTML={{ __html: html }} />

            <Box component="footer" sx={{ mt: '50px', pb: '36px', borderBottom: '1px solid #ededed', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '20px' }}>
              {post.tags.length > 0 && (
                <Box sx={{ display: 'flex', gap: '10px', alignItems: 'flex-start', flex: '1 1 300px' }}>
                  <LocalOfferOutlinedIcon sx={{ fontSize: 16, mt: '3px', color: 'brand.footerLink' }} />
                  <Typography component="ul" aria-label="Tags" sx={{ display: 'flex', flexWrap: 'wrap', gap: '4px 10px', color: 'brand.footerLink', fontSize: 13, fontWeight: 500, listStyle: 'none', m: 0, p: 0 }}>
                    {post.tags.map((t) => (
                      <li key={t.id}>{t.name}</li>
                    ))}
                  </Typography>
                </Box>
              )}
              <ShareButton url={url} title={post.title} />
            </Box>

            <PostNavigation slug={post.slug} />
          </Box>
        </Container>
      </Box>
    </>
  );
}
