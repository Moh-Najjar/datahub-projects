import { useId, useState } from 'react';
import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import Collapse from '@mui/material/Collapse';
import Container from '@mui/material/Container';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Typography from '@mui/material/Typography';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme, type Theme } from '@mui/material/styles';
import CheckIcon from '@mui/icons-material/Check';
import { ButtonLink } from '@/shared/components/ui/ButtonLink';
import { Reveal } from '@/shared/components/ui/Reveal';
import { SectionHeading } from '@/components/common/SectionHeading/SectionHeading';
import { SmartLink } from '@/shared/components/ui/SmartLink';
import { WaveSeparator } from '@/components/common/WaveSeparator/WaveSeparator';
import type { HomeContent, SolutionTab } from '@/content/home';
import { colors } from '@/shared/theme/tokens';

/** Shared look of a tab / accordion header (WPBakery "vc_tta" tabs on the original). */
const headerSx = {
  minHeight: 60,
  maxWidth: 'none',
  p: '21px 10px 19px',
  border: `1px solid ${colors.border}`,
  borderRadius: '5px',
  color: 'text.primary',
  fontSize: 13,
  fontWeight: 500,
  lineHeight: 1.4,
  textTransform: 'uppercase',
  transition: 'all .3s',
  '&:hover': { color: 'brand.dark' },
  '&.Mui-selected, &[aria-expanded="true"]': { color: 'common.white', borderColor: 'brand.dark', backgroundImage: (t: Theme) => t.palette.brand.gradient },
} as const;

function PanelBody({ tab }: { tab: SolutionTab }) {
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '7fr 5fr' }, gap: '30px' }}>
      <Typography>{tab.text}</Typography>
      <Box>
        <Box component="ul" sx={{ display: 'grid', rowGap: '12px' }}>
          {tab.items.map((item) => (
            <li key={item.href}>
              <Box
                component={SmartLink}
                href={item.href}
                sx={{ display: 'flex', alignItems: 'center', gap: '14px', color: 'brand.heading', '&:hover': { color: 'info.main' } }}
              >
                <CheckIcon sx={{ fontSize: 26, color: 'brand.dark' }} />
                <Typography component="h6" sx={{ color: 'inherit', fontSize: 24, lineHeight: 1.25 }}>
                  {item.label}
                </Typography>
              </Box>
            </li>
          ))}
        </Box>
        <ButtonLink variant="textArrow" href={tab.viewAll.href} sx={{ mt: '31px' }}>
          {tab.viewAll.label}
        </ButtonLink>
      </Box>
    </Box>
  );
}

/**
 * "Our Solutions & Services" — tabs on tablet/desktop, an accordion on phones
 * (the original's WPBakery tabs switch layout the same way).
 */
export function SolutionsSection({ content }: { content: HomeContent['solutions'] }) {
  const theme = useTheme();
  const isTabs = useMediaQuery(theme.breakpoints.up('md'));
  const [active, setActive] = useState(0);
  const uid = useId();
  const ids = (i: number) => ({ tab: `${uid}-tab-${i}`, panel: `${uid}-panel-${i}` });
  const tab = content.tabs[active];

  return (
    <Box
      component="section"
      aria-label={content.label}
      sx={{ position: 'relative', pt: { xs: '80px', md: '124px' }, pb: { xs: '80px', md: '104px' }, bgcolor: 'common.white' }}
    >
      <Container>
        <SectionHeading label={content.label} title={content.heading} sx={{ maxWidth: { lg: 770 } }} />

        {isTabs ? (
          <>
            <Reveal>
              <Tabs
                value={active}
                onChange={(_, v: number) => setActive(v)}
                variant="fullWidth"
                aria-label={content.label}
                slotProps={{ indicator: { sx: { display: 'none' } }, list: { sx: { gap: '30px' } } }}
                sx={{ mt: '82px', minHeight: 0 }}
              >
                {content.tabs.map((t, i) => (
                  <Tab key={t.title} label={t.title} id={ids(i).tab} aria-controls={ids(i).panel} sx={headerSx} />
                ))}
              </Tabs>
            </Reveal>
            {tab && (
              <Box role="tabpanel" id={ids(active).panel} aria-labelledby={ids(active).tab} sx={{ mt: '80px' }}>
                <PanelBody tab={tab} />
              </Box>
            )}
          </>
        ) : (
          <Box sx={{ mt: '50px', display: 'grid', rowGap: '30px' }}>
            {content.tabs.map((t, i) => {
              const open = i === active;
              return (
                <Box key={t.title}>
                  <ButtonBase
                    id={ids(i).tab}
                    aria-expanded={open}
                    aria-controls={ids(i).panel}
                    onClick={() => setActive(i)}
                    sx={{ ...headerSx, width: '100%', justifyContent: 'flex-start', px: '20px', textAlign: 'left' }}
                  >
                    {t.title}
                  </ButtonBase>
                  <Collapse in={open} id={ids(i).panel} role="region" aria-labelledby={ids(i).tab}>
                    <Box sx={{ pt: '40px', pb: '30px' }}>
                      <PanelBody tab={t} />
                    </Box>
                  </Collapse>
                </Box>
              );
            })}
          </Box>
        )}
      </Container>
      <WaveSeparator shape="curve" color={colors.brandDark} height={100} />
    </Box>
  );
}
