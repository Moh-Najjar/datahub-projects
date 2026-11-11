import { use, useEffect, useRef, useState } from 'react';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import Typography from '@mui/material/Typography';
import { useTheme } from '@mui/material/styles';
import CalendarTodayOutlinedIcon from '@mui/icons-material/CalendarTodayOutlined';
import EastIcon from '@mui/icons-material/East';
import { Reveal } from '@/shared/components/ui/Reveal';
import { SmartLink } from '@/shared/components/ui/SmartLink';
import { BLOG_PAGE_SIZE, loadBlogIndex } from '@/features/blog/data/blog';
import { useLocale } from '@/i18n/LocaleContext';
import type { BlogPostSummary } from '@/features/blog/types/blog';
import { formatPostDate, trimExcerpt } from '@/features/blog/utils/date';

/** Blog index card ("grid-classic" style): image, date, title, excerpt, underlined "Read more". */
function ClassicCard({ post }: { post: BlogPostSummary }) {
  const { locale } = useLocale();
  const { direction } = useTheme();
  const href = `/${post.slug}/`;
  return (
    <Box component="article" sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {post.image && (
        <Box component={SmartLink} href={href} tabIndex={-1} aria-hidden="true" sx={{ display: 'block', mb: '20px', transition: 'transform .3s', '&:hover': { transform: 'translateY(-5px)' } }}>
          <Box component="img" src={post.image.grid} alt={post.image.alt || post.title} width={370} height={230} loading="lazy" decoding="async" sx={{ display: 'block', width: '100%', height: 'auto', borderRadius: '5px' }} />
        </Box>
      )}
      <Typography component="div" sx={{ mb: '7px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: 14 }}>
        <CalendarTodayOutlinedIcon sx={{ fontSize: 14 }} />
        <time dateTime={post.date}>{formatPostDate(post.date, locale)}</time>
      </Typography>
      <Typography component="h3" dir="ltr" sx={{ fontSize: 24, lineHeight: 1.5 }}>
        <Box component={SmartLink} href={href} sx={{ color: 'brand.heading', '&:hover': { color: 'info.main' } }}>
          {post.title}
        </Box>
      </Typography>
      <Typography dir="ltr" sx={{ mt: '10px', flexGrow: 1 }}>
        {/* The blog index trims excerpts to 22 words (the homepage cards use 18). */}
        {trimExcerpt(post.excerpt, 22)}
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
 * The blog index grid: 10 posts at a time with infinite loading (as on the original),
 * plus an accessible "Load more" fallback for keyboard and no-IntersectionObserver users.
 */
export function BlogGrid() {
  const posts = use(loadBlogIndex());
  const [count, setCount] = useState(BLOG_PAGE_SIZE);
  const sentinel = useRef<HTMLDivElement>(null);
  const hasMore = count < posts.length;

  useEffect(() => {
    const el = sentinel.current;
    if (!el || !hasMore) return;
    const observer = new IntersectionObserver(([entry]) => entry?.isIntersecting && setCount((c) => c + BLOG_PAGE_SIZE), { rootMargin: '400px 0px' });
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore]);

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
        {posts.slice(0, count).map((post, i) => (
          <Reveal key={post.slug} delay={(i % 3) * 0.08}>
            <ClassicCard post={post} />
          </Reveal>
        ))}
      </Box>
      {hasMore && (
        <Box ref={sentinel} sx={{ pt: '85px', display: 'flex', justifyContent: 'center' }}>
          <Box
            component="button"
            type="button"
            onClick={() => setCount((c) => c + BLOG_PAGE_SIZE)}
            aria-label="Load more posts"
            sx={{ display: 'inline-flex', alignItems: 'center', gap: '10px', color: 'info.main', background: 'none', border: 0, cursor: 'pointer' }}
          >
            <CircularProgress size={28} thickness={3} />
          </Box>
        </Box>
      )}
    </Box>
  );
}
