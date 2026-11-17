import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import { BlogCard, useLatestPosts } from '@/modules/blog';
import { Reveal } from '@/modules/shared/Reveal';
import { SectionHeading } from '@/modules/home/components/SectionHeading';
import type { HomeContent } from '@/modules/home/data/homeContent';

/** The three newest published blog posts (masonry cards). */
export function BlogSection({ content }: { content: HomeContent['blog'] }) {
  const posts = useLatestPosts(3);
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
            <Reveal key={post.slug} delay={i * 0.1}>
              <BlogCard post={post} readMore={content.readMore} />
            </Reveal>
          ))}
        </Box>
      </Container>
    </Box>
  );
}
