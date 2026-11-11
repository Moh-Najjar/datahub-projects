import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import { ButtonLink } from '@/shared/components/ui/ButtonLink';
import { Reveal } from '@/shared/components/ui/Reveal';
import type { XaasCard } from '@/features/home/data/homeContent';

/** DWaaS / DAaaS call-to-action boxes (WPBakery "vc_cta3" with a black background). */
export function XaasSection({ cards }: { cards: XaasCard[] }) {
  return (
    <Box component="section" aria-label={cards.map((c) => c.title).join(', ')} sx={{ pt: { xs: '26px', lg: '51px' }, pb: { xs: '80px', lg: '136px' } }}>
      <Container>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' }, gap: '30px', '& > .xaas-card': { height: '100%' } }}>
          {cards.map((card, i) => (
            <Reveal key={card.abbr} delay={i * 0.1} className="xaas-card">
              <Paper sx={{ height: '100%', p: '28px', bgcolor: 'common.black', border: '1px solid #f0f0f0', borderRadius: '5px', color: 'common.white' }}>
                <Typography component="h2" sx={{ color: 'common.white', fontSize: { xs: 34, md: 42 }, lineHeight: 1.42 }}>
                  {card.abbr}
                </Typography>
                <Typography component="h4" sx={{ mt: '18px', color: 'common.white', fontSize: 24, lineHeight: 1.42 }}>
                  {card.title}
                </Typography>
                <Typography sx={{ mt: '18px', color: 'common.white' }}>{card.text}</Typography>
                <ButtonLink variant="gradient" href={card.href} sx={{ mt: '15px' }}>
                  {card.cta}
                </ButtonLink>
              </Paper>
            </Reveal>
          ))}
        </Box>
      </Container>
    </Box>
  );
}
