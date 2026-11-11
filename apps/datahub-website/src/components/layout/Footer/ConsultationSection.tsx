import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import EmailOutlinedIcon from '@mui/icons-material/EmailOutlined';
import PhoneOutlinedIcon from '@mui/icons-material/PhoneOutlined';
import type { ReactNode } from 'react';
import { Reveal } from '@/shared/components/ui/Reveal';
import { CONTACT_EMAIL, PRIMARY_PHONE } from '@/data/contact';
import { useLocalized } from '@/i18n/LocaleContext';
import { UI } from '@/i18n/ui';
import { AppointmentForm } from '../AppointmentForm/AppointmentForm';

interface ContactLineProps {
  href: string;
  icon: ReactNode;
  label: string;
  value: string;
  /** Phone numbers stay LTR inside Arabic text. */
  ltrValue?: boolean;
}

function ContactLine({ href, icon, label, value, ltrValue }: ContactLineProps) {
  return (
    <Box
      component="a"
      href={href}
      sx={{ display: 'flex', alignItems: 'flex-start', gap: '10px', color: 'common.white', '&:hover, &:focus-visible': { color: 'common.white' } }}
    >
      <Box sx={{ width: 54, flexShrink: 0, pt: '15px', display: 'flex', '& svg': { fontSize: 40 } }}>{icon}</Box>
      <Box>
        <Typography component="h4" sx={{ fontSize: 15, fontWeight: 500, lineHeight: 1.78, textTransform: 'uppercase', color: 'rgba(255,255,255,0.8)' }}>
          {label}
        </Typography>
        <Typography
          dir={ltrValue ? 'ltr' : undefined}
          sx={{ mt: '13px', fontSize: { xs: 20, sm: 25 }, fontWeight: 700, lineHeight: 1.17, color: 'common.white', whiteSpace: 'nowrap' }}
        >
          {value}
        </Typography>
      </Box>
    </Box>
  );
}

/**
 * "Book a free consultation" band shown above the footer on every page
 * (blue background with the dotted world map, contact shortcuts and the appointment form).
 */
export function ConsultationSection() {
  const ui = useLocalized(UI);

  return (
    <Box
      component="section"
      aria-labelledby="consultation-heading"
      sx={{
        py: '100px',
        bgcolor: 'brand.dark',
        backgroundImage: 'url(/assets/backgrounds/consultation-map.png)',
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'left bottom',
      }}
    >
      <Container>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: 'repeat(12, minmax(0, 1fr))' },
            columnGap: '30px',
            rowGap: '60px',
            alignItems: 'center',
          }}
        >
          <Box sx={{ gridColumn: { md: '1 / span 5', lg: '1 / span 4' } }}>
            <Reveal>
              <Typography
                id="consultation-heading"
                component="h3"
                sx={{
                  position: 'relative',
                  pl: '34px',
                  color: 'common.white',
                  fontSize: { xs: 28, md: 34, xl: 40 },
                  fontWeight: 600,
                  lineHeight: 1.2,
                  '&::before': {
                    content: '""',
                    position: 'absolute',
                    top: '50%',
                    left: 0,
                    width: 4,
                    height: '94%',
                    transform: 'translateY(-50%)',
                    bgcolor: 'brand.green',
                  },
                }}
              >
                {ui.consultation.heading}
              </Typography>
            </Reveal>
            <Box sx={{ mt: '48px', display: 'grid', rowGap: '48px' }}>
              <Reveal>
                <ContactLine href={PRIMARY_PHONE.href} icon={<PhoneOutlinedIcon />} label={ui.consultation.callLabel} value={PRIMARY_PHONE.display} ltrValue />
              </Reveal>
              <Reveal>
                <ContactLine href={`mailto:${CONTACT_EMAIL}`} icon={<EmailOutlinedIcon />} label={ui.consultation.emailLabel} value={CONTACT_EMAIL} />
              </Reveal>
            </Box>
          </Box>

          <Box sx={{ gridColumn: { md: '7 / span 6', lg: '8 / span 4' }, mx: { lg: '-15px' } }}>
            <Reveal>
              <Paper sx={{ p: '30px', borderRadius: '5px', maxWidth: { xs: 400, md: 'none' }, mx: { xs: 'auto', md: 0 } }}>
                <AppointmentForm />
              </Paper>
            </Reveal>
          </Box>
        </Box>
      </Container>
    </Box>
  );
}
