import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { Link } from 'react-router-dom';
import { Constellation } from '@/modules/layout/Footer/Constellation';
import { LinkedInIcon } from '@/modules/shared/LinkedInIcon';
import { SmartLink } from '@/modules/shared/SmartLink';
import { ConsultationSection, CONTACT_EMAIL, OFFICES } from '@/modules/contact';
import { FOOTER_COLUMNS } from '@/core/config/navigation';
import { EXTERNAL_LINKS } from '@/core/routes/paths';
import { useAlternateHref } from '@/i18n/useAlternateHref';
import { useRouteKey } from '@/core/hooks/useRouteKey';
import pageChrome from '@/content/pages/chrome.json';
import { useLocale, useLocalized } from '@/i18n/LocaleContext';
import { UI } from '@/i18n';
import { colors } from '@/core/theme/tokens';
import { Logo } from '@/modules/layout/Header/Logo';

const columnTitleSx = { mb: '18px', color: 'common.white', fontSize: 20, fontWeight: 400, lineHeight: 1.42, textDecoration: 'underline' } as const;

/** Dark footer with the animated constellation background, contact column and service menus. */
function FooterMain() {
  const ui = useLocalized(UI);
  const offices = useLocalized(OFFICES);
  const columns = useLocalized(FOOTER_COLUMNS);
  const year = new Date().getFullYear();

  return (
    <Box sx={{ position: 'relative', overflow: 'hidden', bgcolor: 'brand.footer' }}>
      <Constellation starColor={colors.brandDark} lineColor="#36a829" />
      <Box sx={{ position: 'relative', maxWidth: 1232, mx: 'auto', pt: '70px', pb: '18px', pointerEvents: 'none', '& a': { pointerEvents: 'auto' } }}>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))', lg: 'repeat(5, minmax(0, 1fr))' }, rowGap: '30px' }}>
          <Box sx={{ px: '16px' }}>
            <Typography component="h2" sx={{ mb: '21px', mt: '10px', color: 'common.white', fontSize: 18, fontWeight: 600, lineHeight: 1.67 }}>
              {ui.footer.connect}
            </Typography>
            {offices.map((office) => (
              <Box key={office.phone} sx={{ color: 'common.white', '& p': { mb: '23px' } }}>
                <p>
                  {office.label && <strong>{office.label} </strong>}
                  {office.address}
                </p>
                <p>
                  {office.label && <strong>{ui.footer.phone}: </strong>}
                  <span dir="ltr">{office.phone}</span>
                </p>
              </Box>
            ))}
            <Box component="a" href={`mailto:${CONTACT_EMAIL}`} sx={{ fontWeight: 700, color: 'common.white', '&:hover': { color: 'info.main' } }}>
              {CONTACT_EMAIL}
            </Box>
            <Box
              component="a"
              href={EXTERNAL_LINKS.linkedin}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="LinkedIn"
              sx={{ display: 'inline-flex', mt: '20px', ml: '-8px', px: '8px', py: '5px', color: 'text.primary', '&:hover': { color: 'common.white' } }}
            >
              <LinkedInIcon sx={{ fontSize: 32 }} />
            </Box>
          </Box>

          {columns.map((col) => (
            <Box key={col.title} component="nav" aria-label={col.title} sx={{ px: '16px' }}>
              <Typography component="h2" sx={columnTitleSx}>
                {col.title}
              </Typography>
              <Box component="ul">
                {[...col.links, col.more].map((link) => (
                  <li key={link.href + link.label}>
                    <Box
                      component={SmartLink}
                      href={link.href}
                      sx={{ display: 'block', py: '6px', color: 'brand.footerLink', fontSize: 15, lineHeight: 1.2, '&:hover': { color: 'common.white' } }}
                    >
                      {link.label}
                    </Box>
                  </li>
                ))}
              </Box>
            </Box>
          ))}
        </Box>

        <Box sx={{ mt: '50px', mx: '16px', pt: '48px', borderTop: '1px solid rgba(255,255,255,0.1)', textAlign: 'center' }}>
          <Box sx={{ display: 'inline-block' }}>
            <Logo variant="white" />
          </Box>
          <Typography sx={{ mt: '22px', mb: '26px', color: 'text.secondary' }}>{`© ${year} ${ui.footer.copyright}`}</Typography>
        </Box>
      </Box>
    </Box>
  );
}

/** WPML footer language list ("العربية (Arabic)" · "English" with flags). */
function LanguageBar() {
  const altHref = useAlternateHref();
  const { locale } = useLocale();
  const entries = [
    { code: 'ar', label: 'العربية (Arabic)', flag: '/assets/icons/flag-ar.svg' },
    { code: 'en', label: 'English', flag: '/assets/icons/flag-en.svg' },
  ] as const;

  return (
    <Box component="nav" aria-label="Language" sx={{ py: '7px', mb: '30px', display: 'flex', justifyContent: 'center' }}>
      <Box component="ul" sx={{ display: 'flex' }}>
        {entries.map((e) => (
          <li key={e.code}>
            <Box
              component={Link}
              to={e.code === locale ? altHref(locale) : altHref(e.code)}
              hrefLang={e.code}
              lang={e.code}
              aria-current={e.code === locale ? 'true' : undefined}
              sx={{ display: 'flex', alignItems: 'center', gap: '6px', p: '5px 10px 6px', color: '#444', fontSize: 15, lineHeight: 1, '&:hover': { color: 'info.main' } }}
            >
              <img src={e.flag} width={18} height={12} alt="" />
              {e.label}
            </Box>
          </li>
        ))}
      </Box>
    </Box>
  );
}

/** Per-page layout flags captured from the original by scripts/convert-pages.ts. */
const PAGE_CHROME = pageChrome as Record<string, { consultation: boolean } | undefined>;

/**
 * Global footer: consultation band, dark footer and language bar.
 * Some original pages hide the consultation band (e.g. Contact, which has its own form).
 */
export function Footer() {
  const routeKey = useRouteKey();
  const hideConsultation = routeKey ? PAGE_CHROME[routeKey]?.consultation === false : false;
  return (
    <Box component="footer">
      {!hideConsultation && <ConsultationSection />}
      <FooterMain />
      <LanguageBar />
    </Box>
  );
}
