import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import GlobalStyles from '@mui/material/GlobalStyles';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import PrintOutlinedIcon from '@mui/icons-material/PrintOutlined';
import { Link as RouterLink, useParams } from 'react-router-dom';
import { useBreadcrumbTail } from '@/core/hooks/breadcrumbContext';
import { ROUTES } from '@/core/routes/paths';
import { fill } from '@/i18n';
import { formatLongDate, formatNumber } from '@/i18n/format';
import { useLocale } from '@/i18n/LocaleContext';
import { useT } from '@/i18n/useT';
import { PageContainer } from '@/modules/shared/PageContainer';
import { ErrorState, LoadingState } from '@/modules/shared/states';
import { useCertificate } from './hooks/useCertificates';

/** Print rules: A4 landscape, no page chrome, backgrounds and borders kept. The shell already hides itself in print. */
const printStyles = (
  <GlobalStyles
    styles={{
      '@page': { size: 'A4 landscape', margin: 0 },
      '@media print': {
        body: { backgroundColor: '#ffffff !important', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' },
        main: { padding: '0 !important' },
        '.certificate-sheet': { width: '297mm !important', height: '210mm !important', maxWidth: 'none !important', margin: '0 !important', boxShadow: 'none !important', border: '0 !important', borderRadius: '0 !important', pageBreakInside: 'avoid' },
        '.no-print': { display: 'none !important' },
      },
    }}
  />
);

/**
 * A completion certificate, printable with the browser ("Print / Save as PDF"). It carries the trainee, the training,
 * the completion date, DataHub branding (a typographic monogram — no artwork is invented) and a unique reference.
 */
export default function CertificatePage() {
  const t = useT();
  const { locale, isRtl } = useLocale();
  const { enrollmentId } = useParams();
  const query = useCertificate(enrollmentId);
  const certificate = query.data;
  useBreadcrumbTail(certificate ? certificate.reference : undefined);
  const BackIcon = isRtl ? ArrowForwardIcon : ArrowBackIcon;

  return (
    <PageContainer>
      {printStyles}
      <Stack className="no-print" direction="row" useFlexGap spacing={1.5} sx={{ justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', mb: 3 }}>
        <Button component={RouterLink} to={ROUTES.certificates} startIcon={<BackIcon />}>
          {t.certificates.back}
        </Button>
        {certificate && (
          <Button variant="contained" startIcon={<PrintOutlinedIcon />} onClick={() => window.print()}>
            {t.certificates.print}
          </Button>
        )}
      </Stack>

      {query.isLoading && <LoadingState />}
      {query.isError && <ErrorState error={query.error} onRetry={() => query.refetch()} />}
      {certificate && (
        <Box
          className="certificate-sheet"
          component="section"
          aria-label={t.certificates.documentTitle}
          sx={{
            containerType: 'inline-size',
            width: '100%',
            maxWidth: 1040,
            mx: 'auto',
            aspectRatio: '297 / 210',
            bgcolor: '#fff',
            color: '#141b26',
            borderRadius: 2,
            boxShadow: 3,
            p: '3.2cqw',
            display: 'flex',
          }}
        >
          <Box sx={{ flex: 1, border: '0.5cqw solid #1456c8', outline: '0.15cqw solid #2a9243', outlineOffset: '-1.4cqw', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between', textAlign: 'center', px: '6cqw', py: '4cqw' }}>
            <Stack spacing="0.8cqw" sx={{ alignItems: 'center' }}>
              <Box aria-hidden dir="ltr" sx={{ width: '6cqw', height: '6cqw', borderRadius: '1.4cqw', display: 'grid', placeItems: 'center', color: '#fff', fontWeight: 800, fontSize: '2.2cqw', background: 'linear-gradient(135deg, #1456c8, #0b3d91)', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>
                DH
              </Box>
              <Typography component="p" sx={{ fontSize: '1.7cqw', fontWeight: 700, letterSpacing: '0.04em', color: '#0b3d91' }}>
                {t.certificates.issuer}
              </Typography>
            </Stack>

            <Box>
              <Typography component="h2" sx={{ fontSize: '4.2cqw', fontWeight: 750, letterSpacing: '-0.01em', color: '#0b3d91', lineHeight: 1.15 }}>
                {t.certificates.documentTitle}
              </Typography>
              <Typography sx={{ fontSize: '1.7cqw', color: '#4d596b', mt: '1.6cqw' }}>{t.certificates.certifies}</Typography>
              <Typography component="p" sx={{ fontSize: '4.4cqw', fontWeight: 700, my: '1.2cqw', overflowWrap: 'anywhere', borderBottom: '0.2cqw solid #c0c9d6', display: 'inline-block', px: '3cqw', lineHeight: 1.3 }}>
                {certificate.traineeName}
              </Typography>
              <Typography sx={{ fontSize: '1.7cqw', color: '#4d596b' }}>{t.certificates.completed}</Typography>
              <Typography component="p" sx={{ fontSize: '2.8cqw', fontWeight: 650, mt: '0.8cqw', overflowWrap: 'anywhere' }}>
                {certificate.trainingTitle}
              </Typography>
              <Typography sx={{ fontSize: '1.6cqw', color: '#4d596b', mt: '1.2cqw' }}>
                {[certificate.departmentName, certificate.durationHours ? fill(t.trainings.hours, { count: formatNumber(certificate.durationHours, locale) }) : null].filter(Boolean).join(' · ')}
              </Typography>
            </Box>

            <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'flex-end', width: '100%' }} spacing="2cqw">
              <Box sx={{ textAlign: 'start', minWidth: 0 }}>
                <Typography sx={{ fontSize: '1.3cqw', color: '#667386' }}>{t.certificates.completedOn}</Typography>
                <Typography sx={{ fontSize: '1.7cqw', fontWeight: 650 }}>{formatLongDate(certificate.completedAt, locale)}</Typography>
              </Box>
              <Box sx={{ textAlign: 'center', minWidth: 0 }}>
                <Box sx={{ borderTop: '0.2cqw solid #141b26', pt: '0.6cqw', px: '3cqw' }}>
                  <Typography sx={{ fontSize: '1.5cqw', fontWeight: 650 }}>{certificate.trainerName ?? t.certificates.issuer}</Typography>
                  <Typography sx={{ fontSize: '1.2cqw', color: '#667386' }}>{certificate.trainerName ? t.certificates.trainer : t.certificates.authorised}</Typography>
                </Box>
              </Box>
              <Box sx={{ textAlign: 'end', minWidth: 0 }}>
                <Typography sx={{ fontSize: '1.3cqw', color: '#667386' }}>{t.certificates.reference}</Typography>
                <Typography dir="ltr" sx={{ fontSize: '1.5cqw', fontWeight: 650, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', textAlign: 'end' }}>
                  {certificate.reference}
                </Typography>
              </Box>
            </Stack>
          </Box>
        </Box>
      )}
    </PageContainer>
  );
}
