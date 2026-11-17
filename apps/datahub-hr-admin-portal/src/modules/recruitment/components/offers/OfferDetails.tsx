import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Link from '@mui/material/Link';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import ArrowBackOutlined from '@mui/icons-material/ArrowBackOutlined';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink, useParams } from 'react-router-dom';
import { useBreadcrumbs } from '@/core/context/breadcrumbContext';
import { useLanguage } from '@/i18n/useLanguage';
import { Feedback } from '@/modules/shared/Feedback';
import { useFeedback } from '@/modules/shared/hooks/useFeedback';
import { DetailList, Panel, QueryBoundary } from '@/modules/shared/Panel';
import { useOffer } from '@/modules/recruitment/hooks/useRecruitment';
import { recruitmentPaths } from '@/modules/recruitment/paths';
import type { Offer } from '@/modules/recruitment/types/recruitment';
import { formatDay, formatMoney, formatTimestamp, personName } from '@/modules/recruitment/utils/format';
import { OfferStatusChip } from '../common/StatusChips';
import { useOfferActions } from './useOfferActions';

const backIconSx = { transform: (theme: { direction: string }) => (theme.direction === 'rtl' ? 'scaleX(-1)' : undefined) };

/** `/recruitment/offers/:offerId` */
export function OfferDetails() {
  const { t } = useTranslation('recruitment');
  const { offerId = '' } = useParams();
  const query = useOffer(offerId);
  return (
    <Stack spacing={2.5}>
      <div>
        <Button component={RouterLink} to={recruitmentPaths.offers} size="small" startIcon={<ArrowBackOutlined sx={backIconSx} />}>
          {t('actions.backToOffers')}
        </Button>
      </div>
      <QueryBoundary query={query} notFoundText={t('offers.notFound')} forbiddenText={t('details.forbidden')}>
        {query.data && <OfferView offer={query.data} />}
      </QueryBoundary>
    </Stack>
  );
}

function OfferView({ offer: o }: { offer: Offer }) {
  const { t } = useTranslation('recruitment');
  const { language } = useLanguage();
  const feedback = useFeedback();
  const actions = useOfferActions(feedback.notify, { includeView: false });
  useBreadcrumbs([{ label: t('tabs.offers'), to: recruitmentPaths.offers }, { label: o.number }]);
  const name = personName(o.candidate.name, language);
  return (
    <>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1.5 }}>
          <Typography variant="h5" component="h2">
            {name}
          </Typography>
          <Chip size="small" variant="outlined" label={o.number} dir="ltr" sx={{ fontFamily: 'monospace' }} />
          <OfferStatusChip status={o.status} />
        </Box>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
          {actions.actionsFor(o).map((a) => {
            const Icon = a.icon;
            return (
              <Button key={a.label} variant="outlined" startIcon={<Icon />} onClick={a.onClick}>
                {a.label}
              </Button>
            );
          })}
        </Box>
      </Box>
      <Alert severity="info">{t('offers.simulatedNote')}</Alert>
      <Panel title={t('offers.details')}>
        <DetailList
          items={[
            { label: t('fields.candidate'), value: <Link component={RouterLink} to={recruitmentPaths.candidate(o.candidate.id)}>{`${name} (${o.candidate.number})`}</Link> },
            { label: t('fields.requisition'), value: <Link component={RouterLink} to={recruitmentPaths.requisition(o.requisition.id)}>{`${o.requisition.number} · ${o.requisition.title[language]}`}</Link> },
            { label: t('fields.position'), value: o.position.name[language] },
            { label: t('fields.department'), value: o.department.name[language] },
            { label: t('fields.location'), value: o.location.name[language] },
            { label: t('fields.salary'), value: <span dir="ltr">{formatMoney(o.salary, o.currency, language)}</span> },
            { label: t('fields.employmentType'), value: t(`employmentTypes.${o.employmentType}`) },
            { label: t('fields.startDate'), value: formatDay(o.startDate, language) },
            { label: t('fields.expiryDate'), value: formatDay(o.expiryDate, language) },
            { label: t('fields.benefits'), value: o.benefits || '—' },
          ]}
        />
      </Panel>
      <Panel title={t('details.statusHistory')}>
        <Box component="ol" sx={{ listStyle: 'none', m: 0, p: 0, display: 'grid', gap: 1.25 }}>
          {[...o.history].reverse().map((h, i) => (
            <Box component="li" key={`${h.at}-${i}`}>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                {t(`offerStatus.${h.to}`)}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {h.by[language]} · {formatTimestamp(h.at, language)}
                {h.note ? ` · ${h.note}` : ''}
              </Typography>
            </Box>
          ))}
        </Box>
      </Panel>
      {actions.dialogs}
      <Feedback {...feedback} />
    </>
  );
}
