import { useEffect, useRef } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Typography from '@mui/material/Typography';
import { useTheme } from '@mui/material/styles';
import CalendarTodayOutlinedIcon from '@mui/icons-material/CalendarTodayOutlined';
import EastIcon from '@mui/icons-material/East';
import type { BlogListItem } from '@/core/types/blog';
import { useInfiniteBlogs } from '@/core/hooks/useBlogs';
import { UI } from '@/i18n';
import { useLocale } from '@/i18n/LocaleContext';
import { Reveal } from '@/modules/shared/Reveal';
import { SmartLink } from '@/modules/shared/SmartLink';
import { PostImage } from '@/modules/blog/components/PostImage';
import { formatPostDate, trimExcerpt } from '@/modules/blog/utils/date';

/** Posts per request — the original loads 10 at a time. */
export const BLOG_GRID_PAGE_SIZE = 10;

/** Blog index card ("grid-classic" style): image, date, title, excerpt, underlined "Read more". */
function ClassicCard({ post }: { post: BlogListItem }) {
  const { locale } = useLocale();
  const { direction } = useTheme();
  const href = `/${post.slug}/`;
  return (
    <Box component="article" sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Box component={SmartLink} href={href} tabIndex={-1} aria-hidden="true" sx={{ display: 'block', mb: '20px', transition: 'transform .3s', '&:hover': { transform: 'translateY(-5px)' } }}>
        <PostImage src={post.featuredImageUrl} alt={post.title} width={370} height={230} radius="5px" />
      </Box>
      {post.publishedAtUtc && (
        <Typography component="div" sx={{ mb: '7px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: 14 }}>
          <CalendarTodayOutlinedIcon sx={{ fontSize: 14 }} />
          <time dateTime={post.publishedAtUtc}>{formatPostDate(post.publishedAtUtc, locale)}</time>
        </Typography>
      )}
      <Typography component="h3" dir="ltr" sx={{ fontSize: 24, lineHeight: 1.5 }}>
        <Box component={SmartLink} href={href} sx={{ color: 'brand.heading', '&:hover': { color: 'info.main' } }}>
          {post.title}
        </Box>
      </Typography>
      {/* The blog index trims excerpts to 22 words (the homepage cards use 18). Missing excerpts are left out. */}
      <Typography dir="ltr" sx={{ mt: '10px', flexGrow: 1 }}>
        {post.excerpt ? trimExcerpt(post.excerpt, 22) : null}
      </Typography>
      <Box sx={{ mt: '20px' }}>
        <Box
          component={SmartLink}
          href={href}
          aria-label={`Read more: ${post.title}`}
          sx={{ display: 'inline-flex', alignItems: 'center', gap: '8px', pb: '2px', borderBottom: '1px solid', borderColor: 'info.main', color: 'info.main', fontSize: 14, fontWeight: 500 }}
        >
          Read more
          <EastIcon sx={{ fontSize: 16, transform: direction === 'rtl' ? 'scaleX(-1)' : undefined }} />
        </Box>
      </Box>
    </Box>
  );
}

/**
 * The blog index grid: published posts from the backend, 10 per request (server-side pagination), loaded as the
 * visitor scrolls (as on the original), plus an accessible "Load more" button for keyboard and no-IntersectionObserver
 * users. Loading, error and empty states are shown in place.
 */
export function BlogGrid() {
  const { locale } = useLocale();
  const t = UI[locale].blog;
  const { data, status, refetch, fetchNextPage, hasNextPage, isFetchingNextPage, isFetchNextPageError } = useInfiniteBlogs(BLOG_GRID_PAGE_SIZE);
  const sentinel = useRef<HTMLDivElement>(null);
  const posts = data?.pages.flatMap((page) => page.items) ?? [];
  const canLoadMore = Boolean(hasNextPage) && !isFetchingNextPage && !isFetchNextPageError;

  useEffect(() => {
    const el = sentinel.current;
    if (!el || !canLoadMore || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(([entry]) => entry?.isIntersecting && void fetchNextPage(), { rootMargin: '400px 0px' });
    observer.observe(el);
    return () => observer.disconnect();
  }, [canLoadMore, fetchNextPage]);

  if (status === 'pending') {
    return (
      <Box role="status" aria-label={t.loading} sx={{ display: 'flex', justifyContent: 'center', py: '85px' }}>
        <CircularProgress size={28} thickness={3} />
      </Box>
    );
  }
  if (status === 'error' && posts.length === 0) {
    return (
      <Alert severity="error" action={<Button color="inherit" onClick={() => void refetch()}>{t.retry}</Button>}>
        {t.error}
      </Alert>
    );
  }
  if (posts.length === 0) {
    return <Typography sx={{ textAlign: 'center', py: '60px' }}>{t.empty}</Typography>;
  }

  return (
    <Box>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))', lg: 'repeat(3, minmax(0, 1fr))' },
          columnGap: { xs: '30px', lg: '50px' },
          rowGap: { xs: '60px', lg: '100px' },
        }}
      >
        {posts.map((post, i) => (
          <Reveal key={post.id} delay={(i % 3) * 0.08}>
            <ClassicCard post={post} />
          </Reveal>
        ))}
      </Box>
      {isFetchNextPageError && (
        <Alert severity="error" sx={{ mt: '60px' }} action={<Button color="inherit" onClick={() => void fetchNextPage()}>{t.retry}</Button>}>
          {t.error}
        </Alert>
      )}
      {hasNextPage && !isFetchNextPageError && (
        <Box ref={sentinel} sx={{ pt: '85px', display: 'flex', justifyContent: 'center' }}>
          <Box
            component="button"
            type="button"
            onClick={() => void fetchNextPage()}
            disabled={isFetchingNextPage}
            aria-label={t.loadMore}
            sx={{ display: 'inline-flex', alignItems: 'center', gap: '10px', color: 'info.main', background: 'none', border: 0, cursor: 'pointer' }}
          >
            <CircularProgress size={28} thickness={3} />
          </Box>
        </Box>
      )}
    </Box>
  );
}
