import { useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import ArrowBackOutlined from '@mui/icons-material/ArrowBackOutlined';
import EditOutlined from '@mui/icons-material/EditOutlined';
import ToggleOffOutlined from '@mui/icons-material/ToggleOffOutlined';
import ToggleOnOutlined from '@mui/icons-material/ToggleOnOutlined';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink, useParams } from 'react-router-dom';
import { formatDate } from '@/i18n/format';
import { useLanguage } from '@/i18n/useLanguage';
import { useLocation, useUpdateLocationStatus } from '@/modules/organization/hooks/useOrganization';
import { useOrganizationAccess } from '@/modules/organization/hooks/useOrganizationAccess';
import { useStatusFlow } from '@/modules/organization/hooks/useStatusFlow';
import { orgPaths } from '@/modules/organization/paths';
import type { Location } from '@/modules/organization/types/organization';
import { countryName } from '@/modules/organization/utils/countries';
import { Feedback } from '@/modules/shared/Feedback';
import { useFeedback } from '@/modules/shared/hooks/useFeedback';
import { DetailList, Panel, QueryBoundary } from '@/modules/shared/Panel';
import { StatusChip } from '@/modules/shared/StatusChip';
import { LocationFormDialog } from './LocationFormDialog';

/** One location's details, with edit / activate / deactivate for writers. */
export function LocationDetails() {
  const { t } = useTranslation('organization');
  const { locationId = '' } = useParams();
  const query = useLocation(locationId);

  return (
    <Stack spacing={2.5}>
      <div>
        <Button component={RouterLink} to={orgPaths.locations} size="small" startIcon={<ArrowBackOutlined sx={{ transform: (theme) => (theme.direction === 'rtl' ? 'scaleX(-1)' : undefined) }} />}>
          {t('actions.backToLocations')}
        </Button>
      </div>
      <QueryBoundary query={query} notFoundText={t('locationDetails.notFound')}>
        {query.data && <LocationView location={query.data} />}
      </QueryBoundary>
    </Stack>
  );
}

function LocationView({ location }: { location: Location }) {
  const { t } = useTranslation('organization');
  const { language } = useLanguage();
  const { canManage } = useOrganizationAccess();
  const feedback = useFeedback();
  const [editing, setEditing] = useState(false);
  const status = useStatusFlow<Location>({
    mutation: useUpdateLocationStatus(),
    name: (l) => l.name[language],
    confirmTitle: (name) => t('confirm.deactivateLocationTitle', { name }),
    confirmText: t('confirm.deactivateLocationText'),
    notify: feedback.notify,
  });

  return (
    <>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1.5, minWidth: 0 }}>
          <Typography variant="h5" component="h2" sx={{ overflowWrap: 'anywhere' }}>
            {location.name[language]}
          </Typography>
          <Chip size="small" variant="outlined" label={location.code} dir="ltr" sx={{ fontFamily: 'monospace' }} />
          <StatusChip status={location.status} />
        </Box>
        {canManage && (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            <Button variant="outlined" startIcon={<EditOutlined />} onClick={() => setEditing(true)}>
              {t('actions.edit')}
            </Button>
            <Button
              variant="outlined"
              color={location.status === 'active' ? 'error' : 'primary'}
              startIcon={location.status === 'active' ? <ToggleOffOutlined /> : <ToggleOnOutlined />}
              onClick={() => status.request(location)}
            >
              {location.status === 'active' ? t('actions.deactivate') : t('actions.activate')}
            </Button>
          </Box>
        )}
      </Box>

      <Panel title={t('tabs.overview')}>
        <DetailList
          items={[
            { label: t('fields.id'), value: <span dir="ltr">{location.id}</span> },
            { label: t('fields.code'), value: <span dir="ltr">{location.code}</span> },
            { label: t('fields.nameEn'), value: <span dir="ltr" lang="en">{location.name.en}</span> },
            { label: t('fields.nameAr'), value: <span dir="rtl" lang="ar">{location.name.ar}</span> },
            { label: t('fields.address'), value: location.address },
            { label: t('fields.city'), value: location.city },
            { label: t('fields.country'), value: countryName(location.country, language) },
            { label: t('fields.status'), value: <StatusChip status={location.status} /> },
            { label: t('fields.createdAt'), value: formatDate(location.createdAt, language) },
          ]}
        />
      </Panel>

      {editing && (
        <LocationFormDialog
          location={location}
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            feedback.notify(t('feedback.locationUpdated'));
          }}
        />
      )}
      {status.dialog}
      <Feedback {...feedback} />
    </>
  );
}
