import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Typography from '@mui/material/Typography';
import CalendarTodayOutlinedIcon from '@mui/icons-material/CalendarTodayOutlined';
import EastIcon from '@mui/icons-material/East';
import { useTheme } from '@mui/material/styles';
import { SmartLink } from '@/components/common/SmartLink/SmartLink';
import { useLocale } from '@/i18n/LocaleContext';
import type { BlogPostSummary } from '@/types/blog';
import { formatPostDate, trimExcerpt } from '@/utils/date';

interface BlogCardProps {
  post: BlogPostSummary;
  readMore: string;
}

/** Post card from the original "grid-masonry" blog style (image, date, title, excerpt, "Read more" bar). */
export function BlogCard({ post, readMore }: BlogCardProps) {
  const { locale } = useLocale();
  const { direction } = useTheme();
  const href = `/${post.slug}/`;

  return (
    <Card
      component="article"
      sx={{
        position: 'relative',
        overflow: 'hidden',
        borderRadius: '5px',
        textAlign: 'center',
        boxShadow: (t) => t.customShadows.card,
        transition: 'transform .3s',
        '&:hover': { transform: 'translateY(-5px)' },
      }}
    >
      {post.image && (
        <SmartLink href={href} tabIndex={-1} aria-hidden="true">
          <Box
            component="img"
            src={post.image.card}
            alt={post.image.alt || post.title}
            width={370}
            height={207}
            loading="lazy"
            decoding="async"
            sx={{ display: 'block', width: '100%', height: 'auto', borderRadius: '5px 5px 0 0' }}
          />
        </SmartLink>
      )}
      <Box sx={{ pt: '29px', px: '25px', pb: '83px' }}>
        <Typography component="div" sx={{ mb: '6px', display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: 14 }}>
          <CalendarTodayOutlinedIcon sx={{ fontSize: 14 }} />
          <time dateTime={post.date}>{formatPostDate(post.date, locale)}</time>
        </Typography>
        <Typography component="h3" sx={{ fontSize: 24, lineHeight: 1.46, mb: '11px' }} dir="ltr">
          <Box component={SmartLink} href={href} sx={{ color: 'brand.heading', '&:hover': { color: 'info.main' } }}>
            {post.title}
          </Box>
        </Typography>
        <Typography sx={{ mt: '10px' }} dir="ltr">
          {trimExcerpt(post.excerpt)}
        </Typography>
      </Box>
      <Box
        component={SmartLink}
        href={href}
        aria-label={`${readMore}: ${post.title}`}
        sx={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '4px',
          height: 56,
          overflow: 'hidden',
          borderTop: '1px solid #eee',
          color: 'brand.dark',
          fontSize: 14,
          fontWeight: 500,
          // Background slides up on hover.
          '&::before': { content: '""', position: 'absolute', inset: 0, zIndex: -1, bgcolor: 'info.main', transform: 'translateY(100%)', transition: 'transform .3s' },
          '&:hover, &:focus-visible': { color: 'common.white', '&::before': { transform: 'none' } },
        }}
      >
        {readMore}
        <EastIcon sx={{ fontSize: 16, transform: direction === 'rtl' ? 'scaleX(-1)' : undefined }} />
      </Box>
    </Card>
  );
}
