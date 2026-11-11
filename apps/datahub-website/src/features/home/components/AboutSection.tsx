import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import { ButtonLink } from '@/shared/components/ui/ButtonLink';
import { Reveal } from '@/shared/components/ui/Reveal';
import { SectionHeading } from '@/features/home/components/SectionHeading';
import { VideoPoster } from '@/shared/components/ui/VideoPoster';
import type { HomeContent } from '@/features/home/data/homeContent';

const INTRO_VIDEO_ID = 'K0jkCpkjfC0';

/** "Where innovation thrives" — intro video, tagline, company description and brochure. */
export function AboutSection({ content }: { content: HomeContent['about'] }) {
  return (
    <Box
      component="section"
      aria-label={content.label}
      sx={{
        pt: { xs: '80px', lg: '120px' },
        pb: { xs: '80px', lg: '100px' },
        bgcolor: 'common.white',
        backgroundImage: 'url(/assets/backgrounds/about-lines.png)',
        backgroundSize: 'cover',
        backgroundRepeat: 'no-repeat',
      }}
    >
      <Container>
        <SectionHeading
          label={content.label}
          title={content.heading}
          titleSize={56}
          titleLineHeight={1.29}
          titleGap={12}
          sx={{ maxWidth: { lg: 877 } }}
        />

        <Box sx={{ mt: '56px', display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' }, gap: { xs: '40px', md: '30px' } }}>
          <Box>
            <Reveal>
              <VideoPoster poster={{ src: '/assets/images/intro-video-thumb.png', alt: content.videoAlt, width: 3840, height: 2160 }} videoId={INTRO_VIDEO_ID} />
            </Reveal>
            <Reveal>
              <Typography component="h4" sx={{ mt: '32px', color: 'brand.dark', fontSize: 20, lineHeight: 1.4 }}>
                {content.tagline}
              </Typography>
            </Reveal>
          </Box>

          <Box>
            {content.paragraphs.map((p) => (
              <Reveal key={p.slice(0, 24)}>
                <Typography sx={{ mb: '28px', fontSize: 17, lineHeight: 1.67 }}>{p}</Typography>
              </Reveal>
            ))}
            <Reveal>
              <ButtonLink href={content.brochure.href} target="_blank" rel="noopener" sx={{ mt: '4px' }}>
                {content.brochure.label}
              </ButtonLink>
            </Reveal>
          </Box>
        </Box>
      </Container>
    </Box>
  );
}
