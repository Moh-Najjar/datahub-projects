import { useMemo, useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import ArrowBackOutlined from '@mui/icons-material/ArrowBackOutlined';
import PictureAsPdfOutlined from '@mui/icons-material/PictureAsPdfOutlined';
import i18n from 'i18next';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink, useParams } from 'react-router-dom';
import { useBreadcrumbs } from '@/core/context/breadcrumbContext';
import type { Locale } from '@/i18n/languages';
import { useLanguage } from '@/i18n/useLanguage';
import { QueryBoundary } from '@/modules/shared/Panel';
import { usePayslip } from '@/modules/payroll/hooks/usePayroll';
import { usePayrollAccess } from '@/modules/payroll/hooks/usePayrollAccess';
import { payrollPaths } from '@/modules/payroll/paths';
import type { Payslip } from '@/modules/payroll/types/payroll';
import { printDocument } from '@/modules/shared/utils/print';
import { PayslipDocument, type PayslipTexts } from './PayslipDocument';

const backIconSx = { transform: (theme: { direction: string }) => (theme.direction === 'rtl' ? 'scaleX(-1)' : undefined) };

/** `/payroll/payslips/:payslipId` — the bilingual payslip, printable / saveable as PDF. Own scope: own payslips only. */
export function PayslipPage() {
  const { t } = useTranslation('payroll');
  const { payslipId = '' } = useParams();
  const { canReadOrganization } = usePayrollAccess();
  const query = usePayslip(payslipId);
  return (
    <Stack spacing={2.5}>
      <div>
        <Button component={RouterLink} to={canReadOrganization ? payrollPaths.payslips : payrollPaths.overview} size="small" startIcon={<ArrowBackOutlined sx={backIconSx} />}>
          {canReadOrganization ? t('actions.backToPayslips') : t('actions.backToMy')}
        </Button>
      </div>
      <QueryBoundary query={query} notFoundText={t('payslips.notFound')}>
        {query.data && <PayslipView payslip={query.data} />}
      </QueryBoundary>
    </Stack>
  );
}

function PayslipView({ payslip }: { payslip: Payslip }) {
  const { t } = useTranslation('payroll');
  const { language } = useLanguage();
  const { canReadOrganization } = usePayrollAccess();
  const [docLanguage, setDocLanguage] = useState<Locale>(language);
  const [printFailed, setPrintFailed] = useState(false);
  useBreadcrumbs(canReadOrganization ? [{ label: t('tabs.payslips'), to: payrollPaths.payslips }, { label: payslip.number }] : [{ label: payslip.number }]);
  const texts = useMemo<PayslipTexts>(() => ({ en: i18n.getFixedT('en', 'payroll'), ar: i18n.getFixedT('ar', 'payroll') }), []);

  const print = async () => {
    // The server renderer is loaded only when a payslip is printed (separate chunk).
    const { renderToStaticMarkup } = await import('react-dom/server');
    const markup = renderToStaticMarkup(<PayslipDocument payslip={payslip} language={docLanguage} texts={texts} />);
    setPrintFailed(!printDocument(payslip.number, markup, docLanguage));
  };

  return (
    <>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 1.5 }}>
        <ToggleButtonGroup size="small" exclusive value={docLanguage} onChange={(_, v: Locale | null) => v && setDocLanguage(v)} aria-label={t('payslips.documentLanguage')}>
          <ToggleButton value="en" lang="en">
            English
          </ToggleButton>
          <ToggleButton value="ar" lang="ar">
            العربية
          </ToggleButton>
        </ToggleButtonGroup>
        <Button variant="contained" startIcon={<PictureAsPdfOutlined />} onClick={() => void print()}>
          {t('actions.downloadPdf')}
        </Button>
      </Box>
      <Alert severity="info">{t('payslips.pdfHint')}</Alert>
      {printFailed && <Alert severity="warning">{t('payslips.printUnavailable')}</Alert>}
      {payslip.paymentStatus === 'approved' && <Alert severity="info">{t('payslips.approvedNotPaid')}</Alert>}
      <Paper variant="outlined" sx={{ bgcolor: '#fff', overflowX: 'auto', borderRadius: 2 }}>
        <PayslipDocument payslip={payslip} language={docLanguage} texts={texts} />
      </Paper>
    </>
  );
}
