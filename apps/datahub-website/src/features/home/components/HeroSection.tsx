import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import EastIcon from '@mui/icons-material/East';
import { useTheme } from '@mui/material/styles';
import { AutoCarousel } from '@/shared/components/ui/AutoCarousel';
import { Reveal } from '@/shared/components/ui/Reveal';
import { SmartLink } from '@/shared/components/ui/SmartLink';
import { WaveSeparator } from '@/features/home/components/WaveSeparator';
import type { HomeContent, ServiceCard } from '@/features/home/data/homeContent';

/** Hero service card ("tm-box-image style-04"): gradient panel that lifts on hover. */
function HeroCard({ card, cta }: { card: ServiceCard; cta: string }) {
  const { direction } = useTheme();
  return (
    <Box
      component={SmartLink}
      href={card.href}
      sx={{
        display: 'block',
        height: '100%',
        pt: '97px',
        pb: '56px',
        px: '42px',
        borderRadius: '5px',
        color: 'common.white',
        backgroundImage: (t) => t.palette.brand.gradient,
        boxShadow: '0 0 25px rgba(51,51,51,.1)',
        transition: 'transform .3s',
        '&:hover, &:focus-visible': { color: 'common.white', transform: 'translateY(-5px)' },
      }}
    >
      <Typography component="h4" sx={{ mb: '9px', color: 'inherit', fontSize: 24, fontWeight: 500, lineHeight: 1.25 }}>
        {card.title}
      </Typography>
      <Typography sx={{ color: 'inherit' }}>{card.text}</Typography>
      <Box sx={{ mt: '27px', display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: 14, fontWeight: 500, lineHeight: 1.74 }}>
        {cta}
        <EastIcon aria-hidden sx={{ fontSize: 16, transform: direction === 'rtl' ? 'scaleX(-1)' : undefined }} />
      </Box>
    </Box>
  );
}

/**
 * Hero: full-width background with a 30% black overlay and a curved bottom edge, followed by
 * the service cards that overlap it (3 per row on desktop; a 4th card is centred below).
 */
export function HeroSection({ content }: { content: HomeContent['hero'] }) {
  return (
    <>
      <Box
        component="section"
        aria-labelledby="hero-title"
        sx={{
          position: 'relative',
          bgcolor: '#111',
          backgroundImage: 'url(/assets/backgrounds/home-hero.jpeg)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundAttachment: { xs: 'scroll', lg: 'fixed' },
          '&::before': { content: '""', position: 'absolute', inset: 0, bgcolor: 'rgba(0,0,0,.3)' },
        }}
      >
        <Container sx={{ position: 'relative', pt: { xs: '100px', xl: '150px' }, pb: { xs: '165px', md: '315px' }, textAlign: 'center' }}>
          <Reveal>
            <Typography id="hero-title" variant="h1" sx={{ color: 'common.white', fontSize: { xs: 26, sm: 34, lg: 45 }, lineHeight: 1.2 }}>
              {content.title}
            </Typography>
          </Reveal>
          <Reveal>
            <Typography component="h4" sx={{ mt: '15px', color: 'common.white', fontSize: { xs: 18, lg: 25 }, fontWeight: 500, lineHeight: 1.42 }}>
              {content.subtitle}
            </Typography>
          </Reveal>
        </Container>
        <WaveSeparator shape="centerCurveAlt" color="#f8f8f8" height={90} />
      </Box>

      <Box component="section" aria-label={content.cards.map((c) => c.title).join(', ')} sx={{ position: 'relative', zIndex: 1 }}>
        <Container sx={{ mt: '-110px' }}>
          {/* First three cards: a row on desktop, a 1-up autoplay slider below 992px (Swiper on the original). */}
          <Reveal>
            <AutoCarousel
              label={content.cards.slice(0, 3).map((c) => c.title).join(', ')}
              items={content.cards.slice(0, 3)}
              getKey={(card) => card.href}
              perView={{ xs: 1, sm: 1, md: 1, lg: 3 }}
              delay={5000}
              speed={500}
              align="stretch"
              renderItem={(card) => <HeroCard card={card} cta={content.cta} />}
            />
          </Reveal>
          {/* Remaining card(s) centred below, spanning two columns on desktop. */}
          {content.cards.slice(3).map((card) => (
            <Reveal key={card.href}>
              <Box sx={{ mt: { xs: '26px', lg: '41px' }, mx: 'auto', maxWidth: { lg: 770 } }}>
                <HeroCard card={card} cta={content.cta} />
              </Box>
            </Reveal>
          ))}
        </Container>
      </Box>
    </>
  );
}
