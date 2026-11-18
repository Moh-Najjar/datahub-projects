import Box from '@mui/material/Box';
import LinearProgress from '@mui/material/LinearProgress';
import Link from '@mui/material/Link';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink } from 'react-router-dom';
import { formatNumber } from '@/i18n/format';
import { useLanguage } from '@/i18n/useLanguage';
import { documentPaths } from '@/modules/documents/paths';
import type { EmployeeCompliance } from '@/modules/documents/types/documents';
import { formatDay } from '@/modules/documents/utils/format';
import { ComplianceChip } from '../common/Chips';

/** The employee's required-document checklist and completeness (information only: nothing is blocked). */
export function ComplianceChecklist({ compliance: c }: { compliance: EmployeeCompliance }) {
  const { t } = useTranslation('documents');
  const { language } = useLanguage();
  if (c.items.length === 0) return <Typography color="text.secondary">{t('compliance.noRules')}</Typography>;
  return (
    <Stack spacing={1.5}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <LinearProgress variant="determinate" value={c.completeness ?? 0} color={c.completeness === 100 ? 'success' : 'primary'} sx={{ flex: 1, height: 8, borderRadius: 4 }} aria-label={t('compliance.completeness')} />
        <Typography variant="body2" sx={{ fontWeight: 600 }} dir="ltr" data-completeness={c.completeness ?? ''}>
          {formatNumber(c.completeness ?? 0, language)}%
        </Typography>
      </Box>
      <Stack component="ul" spacing={1} sx={{ listStyle: 'none', m: 0, p: 0 }} aria-label={t('compliance.checklist')}>
        {c.items.map((i) => (
          <Box component="li" key={i.rule.id} sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1 }} data-compliance={i.status}>
            <Typography variant="body2" sx={{ fontWeight: 500 }}>
              {i.rule.name[language]}
            </Typography>
            <ComplianceChip status={i.status} />
            <Typography variant="caption" color="text.secondary" sx={{ marginInlineStart: 'auto' }}>
              {i.document ? (
                <Link component={RouterLink} to={documentPaths.document(i.document.id)}>
                  {i.document.name}
                </Link>
              ) : i.dueDate ? (
                t('compliance.dueBy', { date: formatDay(i.dueDate, language) })
              ) : i.status === 'missing' ? (
                t('compliance.notProvided')
              ) : null}
            </Typography>
          </Box>
        ))}
      </Stack>
    </Stack>
  );
}
