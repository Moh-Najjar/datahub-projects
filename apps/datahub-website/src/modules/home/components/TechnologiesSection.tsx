import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import { ButtonLink } from '@/shared/components/ui/ButtonLink';
import { Reveal } from '@/shared/components/ui/Reveal';
import { SectionHeading } from '@/features/home/components/SectionHeading';
import type { HomeContent } from '@/features/home/data/homeContent';
import { TECHNOLOGY_LOGOS } from '@/features/home/data/logos';

/** "Tools & Technologies We Use" — logo grid over the geometric texture (95% white overlay). */
export function TechnologiesSection({ content }: { content: HomeContent['technologies'] }) {
  return (
    <Box
      component="section"
      aria-label={content.label}
      sx={{
        position: 'relative',
        py: '75px',
        backgroundImage: 'url(/assets/backgrounds/geometric-texture.jpg)',
        backgroundSize: 'cover',
        backgroundRepeat: 'no-repeat',
        '&::before': { content: '""', position: 'absolute', inset: 0, bgcolor: 'rgba(255,255,255,.95)' },
      }}
    >
      <Container sx={{ position: 'relative', pt: '50px', textAlign: 'center' }}>
        <SectionHeading label={content.label} title={content.heading} titleComponent="h4" titleGap={12} align="center" />

        <Box
          component="ul"
          sx={{
            mt: '25px',
            px: { lg: '25px' },
            display: 'grid',
            gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(4, 1fr)', lg: 'repeat(8, 1fr)' },
            alignItems: 'center',
            justifyItems: 'center',
            columnGap: '25px',
            rowGap: '25px',
          }}
        >
          {TECHNOLOGY_LOGOS.map((logo, i) => (
            <Reveal as="li" key={logo.src} delay={(i % 8) * 0.04}>
              <Box
                component="img"
                src={logo.src}
                alt={logo.alt}
                width={logo.width}
                height={logo.height}
                loading="lazy"
                decoding="async"
                sx={{ width: 118, maxWidth: '100%', height: 'auto' }}
              />
            </Reveal>
          ))}
        </Box>

        <Reveal>
          <ButtonLink variant="textArrow" href={content.viewAll.href} sx={{ mt: '45px' }}>
            {content.viewAll.label}
          </ButtonLink>
        </Reveal>
      </Container>
    </Box>
  );
}
