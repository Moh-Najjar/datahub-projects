import { useState } from 'react';
import Box from '@mui/material/Box';
import Link from '@mui/material/Link';
import Typography from '@mui/material/Typography';
import EditOutlined from '@mui/icons-material/EditOutlined';
import ToggleOffOutlined from '@mui/icons-material/ToggleOffOutlined';
import ToggleOnOutlined from '@mui/icons-material/ToggleOnOutlined';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink } from 'react-router-dom';
import { formatDate } from '@/i18n/format';
import { useLanguage } from '@/i18n/useLanguage';
import { useDepartmentOptions } from '@/modules/organization/hooks/useDepartmentOptions';
import { useListState } from '@/modules/shared/hooks/useListState';
import { usePositions, useUpdatePositionStatus } from '@/modules/organization/hooks/useOrganization';
import { useOrganizationAccess } from '@/modules/organization/hooks/useOrganizationAccess';
import { useStatusFlow } from '@/modules/organization/hooks/useStatusFlow';
import { orgPaths } from '@/modules/organization/paths';
import { EMPLOYMENT_LEVELS, type EmploymentLevel, type Position, type PositionFilters, type PositionSortField, type RecordStatus } from '@/modules/organization/types/organization';
import { DataTable, type Column } from '@/modules/shared/DataTable';
import { visuallyHidden } from '@/modules/shared/styles';
import { Feedback } from '@/modules/shared/Feedback';
import { useFeedback } from '@/modules/shared/hooks/useFeedback';
import { FilterSelect, ListToolbar } from '@/modules/shared/ListToolbar';
import { RowActions } from '@/modules/shared/RowActions';
import { StatusChip } from '@/modules/shared/StatusChip';
import { PositionFormDialog } from './PositionFormDialog';

/** Positions list: search, department/level/status filters, sorting, pagination; writers create/edit/status. */
export function PositionsSection() {
  const { t } = useTranslation('organization');
  const { language } = useLanguage();
  const { canManage } = useOrganizationAccess();
  const list = useListState<PositionFilters, PositionSortField>('title.en');
  const sortBy = list.sortBy === 'title.en' || list.sortBy === 'title.ar' ? (`title.${language}` as const) : list.sortBy;
  const query = usePositions({ ...list.params, sortBy });
  const { options: departmentOptions } = useDepartmentOptions();
  const feedback = useFeedback();
  const [editing, setEditing] = useState<Position | 'new' | null>(null);
  const status = useStatusFlow<Position>({
    mutation: useUpdatePositionStatus(),
    name: (p) => p.title[language],
    confirmTitle: (name) => t('confirm.deactivatePositionTitle', { name }),
    confirmText: t('confirm.deactivatePositionText'),
    notify: feedback.notify,
  });

  const columns: Column<Position, PositionSortField>[] = [
    { id: 'title', label: t('fields.title'), sortField: 'title.en', render: (p) => <Typography variant="body2" sx={{ fontWeight: 500 }}>{p.title[language]}</Typography> },
    { id: 'code', label: t('fields.code'), sortField: 'code', hideBelow: 'sm', render: (p) => <Typography variant="body2" dir="ltr" component="span" sx={{ fontFamily: 'monospace' }}>{p.code}</Typography> },
    {
      id: 'department',
      label: t('fields.department'),
      hideBelow: 'sm',
      render: (p) => (
        <Link component={RouterLink} to={orgPaths.department(p.department.id)}>
          {p.department.name[language]}
        </Link>
      ),
    },
    { id: 'level', label: t('fields.level'), sortField: 'level', hideBelow: 'md', render: (p) => t(`levels.${p.level}`) },
    { id: 'status', label: t('fields.status'), sortField: 'status', render: (p) => <StatusChip status={p.status} /> },
    { id: 'created', label: t('fields.createdAt'), sortField: 'createdAt', hideBelow: 'lg', render: (p) => formatDate(p.createdAt, language) },
    ...(canManage
      ? [
          {
            id: 'actions',
            label: <Box component="span" sx={visuallyHidden}>{t('list.actions')}</Box>,
            align: 'right' as const,
            render: (p: Position) => (
              <RowActions
                name={p.title[language]}
                actions={[
                  { label: t('actions.edit'), icon: EditOutlined, onClick: () => setEditing(p) },
                  p.status === 'active'
                    ? { label: t('actions.deactivate'), icon: ToggleOffOutlined, onClick: () => status.request(p) }
                    : { label: t('actions.activate'), icon: ToggleOnOutlined, onClick: () => status.request(p) },
                ]}
              />
            ),
          },
        ]
      : []),
  ];

  return (
    <section aria-labelledby="org-positions-heading">
      <Typography id="org-positions-heading" variant="h3" component="h2" sx={visuallyHidden}>
        {t('tabs.positions')}
      </Typography>
      <ListToolbar
        search={list.search}
        onSearch={list.setSearch}
        searchLabel={t('list.searchPositions')}
        hasFilters={list.hasFilters}
        onClear={list.clearFilters}
        createLabel={canManage ? t('actions.createPosition') : undefined}
        onCreate={canManage ? () => setEditing('new') : undefined}
        filters={
          <>
            <FilterSelect
              label={t('fields.department')}
              value={list.filters.departmentId ?? ''}
              onChange={(v) => list.setFilter('departmentId', v || undefined)}
              allLabel={t('list.allDepartments')}
              options={departmentOptions.map((o) => ({ value: o.value, label: o.label, depth: o.depth }))}
            />
            <FilterSelect
              label={t('fields.level')}
              value={list.filters.level ?? ''}
              onChange={(v) => list.setFilter('level', (v || undefined) as EmploymentLevel | undefined)}
              allLabel={t('list.allLevels')}
              options={EMPLOYMENT_LEVELS.map((l) => ({ value: l, label: t(`levels.${l}`) }))}
            />
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
      <DataTable label={t('tabs.positions')} columns={columns} getRowId={(p) => p.id} query={query} sort={list} pagination={list} filtered={list.hasFilters} />
      {editing && (
        <PositionFormDialog
          position={editing === 'new' ? undefined : editing}
          onClose={() => setEditing(null)}
          onSaved={(created) => {
            setEditing(null);
            feedback.notify(t(created ? 'feedback.positionCreated' : 'feedback.positionUpdated'));
          }}
        />
      )}
      {status.dialog}
      <Feedback {...feedback} />
    </section>
  );
}
