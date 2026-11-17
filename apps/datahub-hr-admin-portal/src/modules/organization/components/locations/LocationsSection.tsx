import { useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import Link from '@mui/material/Link';
import Typography from '@mui/material/Typography';
import EditOutlined from '@mui/icons-material/EditOutlined';
import ToggleOffOutlined from '@mui/icons-material/ToggleOffOutlined';
import ToggleOnOutlined from '@mui/icons-material/ToggleOnOutlined';
import VisibilityOutlined from '@mui/icons-material/VisibilityOutlined';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink } from 'react-router-dom';
import { formatDate } from '@/i18n/format';
import { useLanguage } from '@/i18n/useLanguage';
import { useListState } from '@/modules/shared/hooks/useListState';
import { useLocations, useUpdateLocationStatus } from '@/modules/organization/hooks/useOrganization';
import { useOrganizationAccess } from '@/modules/organization/hooks/useOrganizationAccess';
import { useStatusFlow } from '@/modules/organization/hooks/useStatusFlow';
import { orgPaths } from '@/modules/organization/paths';
import type { Location, LocationFilters, LocationSortField, RecordStatus } from '@/modules/organization/types/organization';
import { countryName, LOCATION_COUNTRIES } from '@/modules/organization/utils/countries';
import { DataTable, type Column } from '@/modules/shared/DataTable';
import { visuallyHidden } from '@/modules/shared/styles';
import { Feedback } from '@/modules/shared/Feedback';
import { useFeedback } from '@/modules/shared/hooks/useFeedback';
import { FilterSelect, ListToolbar } from '@/modules/shared/ListToolbar';
import { RowActions, type RowAction } from '@/modules/shared/RowActions';
import { StatusChip } from '@/modules/shared/StatusChip';
import { LocationFormDialog } from './LocationFormDialog';

/** Locations list: search, country/status filters, sorting, pagination; writers create/edit/status. */
export function LocationsSection() {
  const { t } = useTranslation('organization');
  const { language } = useLanguage();
  const { canManage } = useOrganizationAccess();
  const list = useListState<LocationFilters, LocationSortField>('name.en');
  const sortBy = list.sortBy === 'name.en' || list.sortBy === 'name.ar' ? (`name.${language}` as const) : list.sortBy;
  const query = useLocations({ ...list.params, sortBy });
  const feedback = useFeedback();
  const [editing, setEditing] = useState<Location | 'new' | null>(null);
  const countries = useMemo(() => LOCATION_COUNTRIES.map((code) => ({ value: code, label: countryName(code, language) })).sort((a, b) => a.label.localeCompare(b.label, language)), [language]);
  const status = useStatusFlow<Location>({
    mutation: useUpdateLocationStatus(),
    name: (l) => l.name[language],
    confirmTitle: (name) => t('confirm.deactivateLocationTitle', { name }),
    confirmText: t('confirm.deactivateLocationText'),
    notify: feedback.notify,
  });

  const actions = (l: Location): RowAction[] => [
    { label: t('actions.viewDetails'), icon: VisibilityOutlined, to: orgPaths.location(l.id) },
    ...(canManage
      ? [
          { label: t('actions.edit'), icon: EditOutlined, onClick: () => setEditing(l) },
          l.status === 'active'
            ? { label: t('actions.deactivate'), icon: ToggleOffOutlined, onClick: () => status.request(l) }
            : { label: t('actions.activate'), icon: ToggleOnOutlined, onClick: () => status.request(l) },
        ]
      : []),
  ];

  const columns: Column<Location, LocationSortField>[] = [
    {
      id: 'name',
      label: t('fields.name'),
      sortField: 'name.en',
      render: (l) => (
        <Link component={RouterLink} to={orgPaths.location(l.id)} sx={{ fontWeight: 500 }}>
          {l.name[language]}
        </Link>
      ),
    },
    { id: 'code', label: t('fields.code'), sortField: 'code', hideBelow: 'sm', render: (l) => <Typography variant="body2" dir="ltr" component="span" sx={{ fontFamily: 'monospace' }}>{l.code}</Typography> },
    { id: 'city', label: t('fields.city'), sortField: 'city', hideBelow: 'sm', render: (l) => l.city },
    { id: 'country', label: t('fields.country'), sortField: 'country', hideBelow: 'md', render: (l) => countryName(l.country, language) },
    { id: 'status', label: t('fields.status'), sortField: 'status', render: (l) => <StatusChip status={l.status} /> },
    { id: 'created', label: t('fields.createdAt'), sortField: 'createdAt', hideBelow: 'lg', render: (l) => formatDate(l.createdAt, language) },
    { id: 'actions', label: <Box component="span" sx={visuallyHidden}>{t('list.actions')}</Box>, align: 'right', render: (l) => <RowActions name={l.name[language]} actions={actions(l)} /> },
  ];

  return (
    <section aria-labelledby="org-locations-heading">
      <Typography id="org-locations-heading" variant="h3" component="h2" sx={visuallyHidden}>
        {t('tabs.locations')}
      </Typography>
      <ListToolbar
        search={list.search}
        onSearch={list.setSearch}
        searchLabel={t('list.searchLocations')}
        hasFilters={list.hasFilters}
        onClear={list.clearFilters}
        createLabel={canManage ? t('actions.createLocation') : undefined}
        onCreate={canManage ? () => setEditing('new') : undefined}
        filters={
          <>
            <FilterSelect label={t('fields.country')} value={list.filters.country ?? ''} onChange={(v) => list.setFilter('country', v || undefined)} allLabel={t('list.allCountries')} options={countries} />
            <FilterSelect
              label={t('fields.status')}
              value={list.filters.status ?? ''}
              onChange={(v) => list.setFilter('status', (v || undefined) as RecordStatus | undefined)}
              allLabel={t('list.allStatuses')}
              options={[
                { value: 'active', label: t('status.active') },
                { value: 'inactive', label: t('status.inactive') },
              ]}
            />
          </>
        }
      />
      <DataTable label={t('tabs.locations')} columns={columns} getRowId={(l) => l.id} query={query} sort={list} pagination={list} filtered={list.hasFilters} />
      {editing && (
        <LocationFormDialog
          location={editing === 'new' ? undefined : editing}
          onClose={() => setEditing(null)}
          onSaved={(created) => {
            setEditing(null);
            feedback.notify(t(created ? 'feedback.locationCreated' : 'feedback.locationUpdated'));
          }}
        />
      )}
      {status.dialog}
      <Feedback {...feedback} />
    </section>
  );
}
