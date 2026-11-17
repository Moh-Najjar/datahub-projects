import { useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Link from '@mui/material/Link';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import ArrowBackOutlined from '@mui/icons-material/ArrowBackOutlined';
import EditOutlined from '@mui/icons-material/EditOutlined';
import ManageAccountsOutlined from '@mui/icons-material/ManageAccountsOutlined';
import ToggleOffOutlined from '@mui/icons-material/ToggleOffOutlined';
import ToggleOnOutlined from '@mui/icons-material/ToggleOnOutlined';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink, useParams } from 'react-router-dom';
import { formatDate, formatNumber } from '@/i18n/format';
import { useLanguage } from '@/i18n/useLanguage';
import { useDepartment, useDepartmentHierarchy, usePositions, useUpdateDepartmentStatus } from '@/modules/organization/hooks/useOrganization';
import { useOrganizationAccess } from '@/modules/organization/hooks/useOrganizationAccess';
import { useStatusFlow } from '@/modules/organization/hooks/useStatusFlow';
import { orgPaths } from '@/modules/organization/paths';
import type { Department } from '@/modules/organization/types/organization';
import { buildTree, flattenTree } from '@/modules/organization/utils/hierarchy';
import { Feedback } from '@/modules/shared/Feedback';
import { useFeedback } from '@/modules/shared/hooks/useFeedback';
import { DetailList, Panel, QueryBoundary } from '@/modules/shared/Panel';
import { StatusChip } from '@/modules/shared/StatusChip';
import { AssignManagerDialog } from './AssignManagerDialog';
import { DepartmentFormDialog } from './DepartmentFormDialog';

const backIconSx = { transform: (theme: { direction: string }) => (theme.direction === 'rtl' ? 'scaleX(-1)' : undefined) };

/** One department: details, subdepartments, positions and (for writers) edit / manager / status actions. */
export function DepartmentDetails() {
  const { t } = useTranslation('organization');
  const { departmentId = '' } = useParams();
  const query = useDepartment(departmentId);

  return (
    <Stack spacing={2.5}>
      <div>
        <Button component={RouterLink} to={orgPaths.departments} startIcon={<ArrowBackOutlined sx={backIconSx} />} size="small">
          {t('actions.backToDepartments')}
        </Button>
      </div>
      <QueryBoundary query={query} notFoundText={t('departmentDetails.notFound')}>
        {query.data && <DepartmentView department={query.data} />}
      </QueryBoundary>
    </Stack>
  );
}

function DepartmentView({ department }: { department: Department }) {
  const { t } = useTranslation('organization');
  const { language } = useLanguage();
  const { canManage } = useOrganizationAccess();
  const feedback = useFeedback();
  const [dialog, setDialog] = useState<'edit' | 'manager' | null>(null);
  const hierarchy = useDepartmentHierarchy();
  const positions = usePositions({ page: 1, pageSize: 100, sortBy: 'code', sortDirection: 'asc', filters: { departmentId: department.id } });
  const status = useStatusFlow<Department>({
    mutation: useUpdateDepartmentStatus(),
    name: (d) => d.name[language],
    confirmTitle: (name) => t('confirm.deactivateDepartmentTitle', { name }),
    confirmText: t('confirm.deactivateDepartmentText'),
    notify: feedback.notify,
  });

  const node = useMemo(() => flattenTree(buildTree(hierarchy.data ?? [], language)).find((n) => n.id === department.id), [hierarchy.data, language, department.id]);
  const none = t('list.none');

  return (
    <>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1.5, minWidth: 0 }}>
          <Typography variant="h5" component="h2" sx={{ overflowWrap: 'anywhere' }}>
            {department.name[language]}
          </Typography>
          <Chip size="small" variant="outlined" label={department.code} dir="ltr" sx={{ fontFamily: 'monospace' }} />
          <StatusChip status={department.status} />
        </Box>
        {canManage && (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            <Button variant="outlined" startIcon={<EditOutlined />} onClick={() => setDialog('edit')}>
              {t('actions.edit')}
            </Button>
            <Button variant="outlined" startIcon={<ManageAccountsOutlined />} onClick={() => setDialog('manager')}>
              {department.manager ? t('actions.changeManager') : t('actions.assignManager')}
            </Button>
            <Button
              variant="outlined"
              color={department.status === 'active' ? 'error' : 'primary'}
              startIcon={department.status === 'active' ? <ToggleOffOutlined /> : <ToggleOnOutlined />}
              onClick={() => status.request(department)}
            >
              {department.status === 'active' ? t('actions.deactivate') : t('actions.activate')}
            </Button>
          </Box>
        )}
      </Box>

      <Panel title={t('tabs.overview')}>
        <DetailList
          items={[
            { label: t('fields.id'), value: <span dir="ltr">{department.id}</span> },
            { label: t('fields.code'), value: <span dir="ltr">{department.code}</span> },
            { label: t('fields.nameEn'), value: <span dir="ltr" lang="en">{department.name.en}</span> },
            { label: t('fields.nameAr'), value: <span dir="rtl" lang="ar">{department.name.ar}</span> },
            {
              label: t('fields.parent'),
              value: department.parent ? (
                <Link component={RouterLink} to={orgPaths.department(department.parent.id)}>
                  {department.parent.name[language]}
                </Link>
              ) : (
                t('forms.noParent')
              ),
            },
            { label: t('fields.manager'), value: department.manager?.name[language] ?? t('overview.noManager') },
            { label: t('fields.employeesDirect'), value: formatNumber(department.employeeCount, language) },
            { label: t('fields.employeesTotal'), value: node ? formatNumber(node.totalEmployees, language) : none },
            { label: t('fields.status'), value: <StatusChip status={department.status} /> },
            { label: t('fields.createdAt'), value: formatDate(department.createdAt, language) },
            { label: t('fields.description'), value: department.description || none },
          ]}
        />
      </Panel>

      <Panel title={t('departmentDetails.subdepartmentsTitle')}>
        {node && node.children.length > 0 ? (
          <List disablePadding>
            {node.children.map((child) => (
              <ListItem key={child.id} divider disableGutters sx={{ gap: 2, flexWrap: 'wrap' }}>
                <ListItemText
                  primary={
                    <Link component={RouterLink} to={orgPaths.department(child.id)}>
                      {child.name[language]}
                    </Link>
                  }
                  secondary={[child.manager?.name[language] ?? t('overview.noManager'), t('hierarchy.employees', { value: formatNumber(child.totalEmployees, language) })].join(' · ')}
                />
                <StatusChip status={child.status} />
              </ListItem>
            ))}
          </List>
        ) : (
          <Typography color="text.secondary">{hierarchy.isPending ? t('forms.loadingOptions') : t('departmentDetails.noSubdepartments')}</Typography>
        )}
      </Panel>

      <Panel title={t('departmentDetails.positionsTitle')} subtitle={t('departmentDetails.positionsSubtitle')}>
        {positions.data && positions.data.items.length > 0 ? (
          <List disablePadding>
            {positions.data.items.map((p) => (
              <ListItem key={p.id} divider disableGutters sx={{ gap: 2, flexWrap: 'wrap' }}>
                <ListItemText primary={p.title[language]} secondary={[p.code, t(`levels.${p.level}`), p.department.name[language]].join(' · ')} />
                <StatusChip status={p.status} />
              </ListItem>
            ))}
          </List>
        ) : (
          <Typography color="text.secondary">{positions.isPending ? t('forms.loadingOptions') : t('departmentDetails.noPositions')}</Typography>
        )}
      </Panel>

      {dialog === 'edit' && (
        <DepartmentFormDialog
          department={department}
          onClose={() => setDialog(null)}
          onSaved={() => {
            setDialog(null);
            feedback.notify(t('feedback.departmentUpdated'));
          }}
        />
      )}
      {dialog === 'manager' && (
        <AssignManagerDialog
          department={department}
          onClose={() => setDialog(null)}
          onSaved={() => {
            setDialog(null);
            feedback.notify(t('feedback.departmentUpdated'));
          }}
        />
      )}
      {status.dialog}
      <Feedback {...feedback} />
    </>
  );
}
