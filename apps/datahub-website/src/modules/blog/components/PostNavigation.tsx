import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import type { BlogListItem } from '@/core/types/blog';
import { useBlogIndex } from '@/core/hooks/useBlogs';
import { SmartLink } from '@/modules/shared/SmartLink';
import { neighboursOf } from '@/modules/blog/utils/neighbours';

/** One card of the original's "blog-nav-links": the post's image under a dark gradient, its title and a chevron. */
function NavCard({ post, direction }: { post: BlogListItem; direction: 'prev' | 'next' }) {
  const prev = direction === 'prev';
  const Chevron = prev ? ChevronLeftIcon : ChevronRightIcon;
  return (
    <Box
      component={SmartLink}
      href={`/${post.slug}/`}
      rel={direction}
      aria-label={`${prev ? 'Previous post' : 'Next post'}: ${post.title}`}
      sx={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        height: 120,
        overflow: 'hidden',
        borderRadius: '5px',
        bgcolor: '#333',
        backgroundImage: post.featuredImageUrl ? `url("${post.featuredImageUrl}")` : undefined,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        color: 'common.white',
        textAlign: prev ? 'left' : 'right',
        // The original's overlay: transparent → black (80%) at half opacity; a little darker on hover.
        '&::before': {
          content: '""',
          position: 'absolute',
          inset: 0,
          backgroundImage: 'linear-gradient(-180deg, rgba(51, 51, 51, 0), #000 80%)',
          opacity: 0.5,
          transition: 'opacity .3s',
        },
        '&:hover': { color: 'common.white' },
        '&:hover::before, &:focus-visible::before': { opacity: 0.8 },
        '&:hover .nav-chevron': {
          transform: `translate(${prev ? '-4px' : '4px'}, -50%)`,
        },
      }}
    >
      <Chevron
        className="nav-chevron"
        aria-hidden
        sx={{
          position: 'absolute',
          top: '50%',
          [prev ? 'left' : 'right']: 14,
          transform: 'translateY(-50%)',
          fontSize: 30,
          transition: 'transform .3s',
        }}
      />
      <Typography
        component="h6"
        sx={{
          position: 'relative',
          width: '100%',
          pl: prev ? '50px' : '20px',
          pr: prev ? '20px' : '50px',
          color: 'inherit',
          fontSize: 18,
          fontWeight: 500,
          lineHeight: 1.56,
          display: '-webkit-box',
          WebkitLineClamp: 3,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}
      >
        {post.title}
      </Typography>
    </Box>
  );
}

/** Previous (older) and next (newer) post, as on the original. Nothing while loading, on error or without neighbours. */
export function PostNavigation({ slug }: { slug: string }) {
  const { data } = useBlogIndex();
  const { older, newer } = data ? neighboursOf(data, slug) : {};
  if (!older && !newer) return null;
  return (
    <Box
      component="nav"
      aria-label="Post navigation"
      sx={{
        mt: '36px',
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
        gap: { xs: '20px', sm: '30px' },
      }}
    >
      {/* An empty column keeps "next" on the right on wide screens; on phones it is hidden. */}
      <Box sx={{ display: older ? 'block' : { xs: 'none', sm: 'block' } }}>
        {older && <NavCard post={older} direction="prev" />}
      </Box>
      <Box sx={{ display: newer ? 'block' : { xs: 'none', sm: 'block' } }}>
        {newer && <NavCard post={newer} direction="next" />}
      </Box>
    </Box>
  );
}
