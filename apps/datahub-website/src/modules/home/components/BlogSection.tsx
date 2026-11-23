import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import { useBlogs } from '@/core/hooks/useBlogs';
import { UI } from '@/i18n';
import { useLocale } from '@/i18n/LocaleContext';
import { BlogCard } from '@/modules/blog';
import { Reveal } from '@/modules/shared/Reveal';
import { SectionHeading } from '@/modules/home/components/SectionHeading';
import type { HomeContent } from '@/modules/home/data/homeContent';

/**
 * The first three published posts of the backend's list (masonry cards). While loading, the cards' space is kept
 * empty (no layout jump); an error or an empty blog shows one short line instead of the cards.
 */
export function BlogSection({ content }: { content: HomeContent['blog'] }) {
  const { locale } = useLocale();
  const t = UI[locale].blog;
  const { data, status } = useBlogs({ pageNumber: 1, pageSize: 3 });
  const posts = data?.items ?? [];
  return (
    <Box component="section" aria-label={content.label} sx={{ pt: '50px', pb: '106px' }}>
      <Container>
        <SectionHeading label={content.label} title={content.heading} titleGap={24} align="center" />
        <Box
          sx={{
            mt: '70px',
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))', lg: 'repeat(3, minmax(0, 1fr))' },
            alignItems: 'start',
            gap: { xs: '30px', lg: '50px' },
          }}
        >
          {posts.map((post, i) => (
            <Reveal key={post.id} delay={i * 0.1}>
              <BlogCard post={post} readMore={content.readMore} />
            </Reveal>
          ))}
        </Box>
        {status === 'error' && <Typography sx={{ textAlign: 'center' }}>{t.error}</Typography>}
        {status === 'success' && posts.length === 0 && <Typography sx={{ textAlign: 'center' }}>{t.empty}</Typography>}
      </Container>
    </Box>
  );
}
