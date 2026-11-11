import { useRef } from 'react';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import { useInView } from 'framer-motion';
import { AutoCarousel } from '@/components/common/AutoCarousel/AutoCarousel';
import { Reveal } from '@/components/common/Reveal/Reveal';
import { Rich } from '@/components/common/Rich/Rich';
import { WaveSeparator } from '@/components/common/WaveSeparator/WaveSeparator';
import type { Counter, HomeContent } from '@/content/home';
import { CLIENT_LOGOS } from '@/data/logos';
import { useCountUp } from '@/hooks/useCountUp';
import { colors } from '@/theme/tokens';

/** "tm-counter style-02": number counting up when scrolled into view, with an uppercase label. */
function CounterItem({ counter }: { counter: Counter }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '0px 0px -60px 0px' });
  const value = useCountUp(counter.value, inView);

  return (
    <Box ref={ref} sx={{ textAlign: 'center' }}>
      <Typography
        aria-label={`${counter.value}${counter.suffix}`}
        sx={{ mb: '19px', color: 'brand.dark', fontSize: { xs: 44, md: 56 }, lineHeight: 1, direction: 'ltr' }}
      >
        <span aria-hidden="true">
          {value}
          {counter.suffix}
        </span>
      </Typography>
      <Typography component="h5" sx={{ color: 'text.secondary', fontSize: 14, fontWeight: 500, letterSpacing: '2px', textTransform: 'uppercase' }}>
        {counter.label}
      </Typography>
    </Box>
  );
}

/** "Highlights from our Success Stories": 110+ headline, counters and the client logo carousel. */
export function StatsSection({ content }: { content: HomeContent['stats'] }) {
  return (
    <Box component="section" aria-labelledby="stats-heading" sx={{ position: 'relative', zIndex: 2, pt: '100px', pb: { xs: '90px', md: '133px' }, bgcolor: 'common.white' }}>
      <Container sx={{ textAlign: 'center' }}>
        <Reveal>
          <Typography id="stats-heading" component="h4" sx={{ fontSize: { xs: 30, md: 40 }, lineHeight: 1.4, color: 'brand.heading' }}>
            <Rich text={content.heading} />
          </Typography>
        </Reveal>
        <Reveal>
          <Typography component="h3" sx={{ mt: '24px', color: 'brand.green', fontSize: { xs: 100, md: 150 }, lineHeight: 1, direction: 'ltr' }}>
            <Box component="mark" sx={{ color: 'inherit' }}>
              {content.highlight}
            </Box>
          </Typography>
        </Reveal>
        <Reveal>
          <Typography component="h3" sx={{ color: 'brand.heading', fontSize: 18, lineHeight: 1.78 }}>
            {content.highlightLabel}
          </Typography>
        </Reveal>

        <Box sx={{ mt: '50px', display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, minmax(0, 1fr))' }, gap: { xs: '40px', sm: '50px' } }}>
          {content.counters.map((c) => (
            <Reveal key={c.label}>
              <CounterItem counter={c} />
            </Reveal>
          ))}
        </Box>

        <Box sx={{ mt: '57px' }}>
          <AutoCarousel
            label="Clients"
            items={CLIENT_LOGOS}
            getKey={(logo) => logo.src}
            perView={{ xs: 2, sm: 3, md: 4, lg: 6 }}
            renderItem={(logo) => (
              <Box
                component="img"
                src={logo.src}
                alt={logo.alt}
                width={logo.width}
                height={logo.height}
                loading="lazy"
                decoding="async"
                sx={{
                  width: 'auto',
                  maxWidth: '100%',
                  height: 'auto',
                  maxHeight: 155,
                  mx: 'auto',
                  transition: 'transform .3s',
                  '&:hover': { transform: 'scale(1.1)' },
                }}
              />
            )}
          />
        </Box>
      </Container>
      <WaveSeparator shape="curve" color={colors.brandDark} height={100} />
    </Box>
  );
}
