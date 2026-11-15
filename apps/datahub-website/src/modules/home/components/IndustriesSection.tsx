import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import { industryAnchor } from '@/shared/config/routes';
import { ButtonLink } from '@/shared/components/ui/ButtonLink';
import { Reveal } from '@/shared/components/ui/Reveal';
import { Rich } from '@/shared/components/ui/Rich';
import type { HomeContent } from '@/features/home/data/homeContent';
import { INDUSTRY_ICONS } from '@/features/home/data/industryIcons';
import { INDUSTRY_IDS } from '@/shared/config/navigation';

/** "Industries We Impact" — shadowed pill links over a half-width tinted panel ("section-half-bg-01"). */
export function IndustriesSection({ content }: { content: HomeContent['industries'] }) {
  return (
    <Box
      component="section"
      aria-labelledby="industries-heading"
      sx={{
        position: 'relative',
        py: '100px',
        '&::before': { content: '""', position: 'absolute', top: 0, bottom: 0, left: 0, width: { xs: '100%', lg: '48%' }, bgcolor: 'brand.bgPanel' },
      }}
    >
      <Container sx={{ position: 'relative' }}>
        <Reveal>
          <Typography id="industries-heading" component="h3" sx={{ fontSize: { xs: 34, md: 50 }, lineHeight: 1.13, color: 'brand.heading' }}>
            <Rich text={content.heading} />
          </Typography>
        </Reveal>
        <Reveal>
          <Typography component="h4" sx={{ mt: '20px', fontSize: { xs: 20, md: 24 }, lineHeight: 1.25, color: 'brand.heading' }}>
            {content.subheading}
          </Typography>
        </Reveal>

        <Box component="ul" sx={{ mt: '28px', display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
          {INDUSTRY_IDS.map((id, i) => {
            const Icon = INDUSTRY_ICONS[id];
            return (
              <Reveal as="li" key={id} delay={i * 0.03}>
                <ButtonLink variant="pill" href={industryAnchor(id)} startIcon={<Icon sx={{ fontSize: '22px !important' }} />}>
                  {content.labels[id]}
                </ButtonLink>
              </Reveal>
            );
          })}
        </Box>
      </Container>
    </Box>
  );
}
