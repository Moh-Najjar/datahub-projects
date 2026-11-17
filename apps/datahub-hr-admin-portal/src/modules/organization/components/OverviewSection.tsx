import { useMemo } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CardActionArea from '@mui/material/CardActionArea';
import Link from '@mui/material/Link';
import Paper from '@mui/material/Paper';
import Skeleton from '@mui/material/Skeleton';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import type { SvgIconComponent } from '@mui/icons-material';
import AccountTreeOutlined from '@mui/icons-material/AccountTreeOutlined';
import ApartmentOutlined from '@mui/icons-material/ApartmentOutlined';
import BadgeOutlined from '@mui/icons-material/BadgeOutlined';
import InfoOutlined from '@mui/icons-material/InfoOutlined';
import PlaceOutlined from '@mui/icons-material/PlaceOutlined';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink } from 'react-router-dom';
import { formatNumber } from '@/i18n/format';
import { useLanguage } from '@/i18n/useLanguage';
import { useDepartmentHierarchy, useOrganizationSummary } from '@/modules/organization/hooks/useOrganization';
import { orgPaths } from '@/modules/organization/paths';
import type { CountWithActive, OrganizationSummary } from '@/modules/organization/types/organization';
import { buildTree } from '@/modules/organization/utils/hierarchy';
import { visuallyHidden } from '@/modules/shared/styles';
import { Panel } from '@/modules/shared/Panel';
import { StatusChip } from '@/modules/shared/StatusChip';

interface CardDef {
  key: keyof OrganizationSummary;
  icon: SvgIconComponent;
  color: 'primary' | 'secondary' | 'success' | 'info';
  to: string;
}

const CARDS: readonly CardDef[] = [
  { key: 'departments', icon: ApartmentOutlined, color: 'primary', to: orgPaths.departments },
  { key: 'positions', icon: BadgeOutlined, color: 'secondary', to: orgPaths.positions },
  { key: 'locations', icon: PlaceOutlined, color: 'info', to: orgPaths.locations },
  { key: 'units', icon: AccountTreeOutlined, color: 'success', to: orgPaths.hierarchy },
];

/** Landing tab: the four totals and the top-level departments. */
export function OverviewSection() {
  return (
    <Box sx={{ display: 'grid', gap: 2.5 }}>
      <SummaryCards />
      <TopLevelDepartments />
    </Box>
  );
}

function SummaryCards() {
  const { t } = useTranslation('organization');
  const { t: tCommon } = useTranslation();
  const query = useOrganizationSummary();

  if (query.isError) {
    return (
      <Alert
        severity="error"
        action={
          <Button color="inherit" size="small" onClick={() => void query.refetch()}>
            {tCommon('actions.retry')}
          </Button>
        }
      >
        {t('list.loadError')}
      </Alert>
    );
  }

  return (
    <Box component="section" aria-label={t('summary.label')}>
      <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0, display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))', lg: 'repeat(4, minmax(0, 1fr))' } }}>
        {CARDS.map((card) => (
          <SummaryCard key={card.key} def={card} value={query.data?.[card.key]} loading={query.isPending} />
        ))}
      </Box>
    </Box>
  );
}

function SummaryCard({ def, value, loading }: { def: CardDef; value?: CountWithActive; loading: boolean }) {
  const { t } = useTranslation('organization');
  const { t: tCommon } = useTranslation();
  const { language } = useLanguage();
  const Icon = def.icon;
  const label = t(`summary.${def.key}.label`);

  return (
    <Paper variant="outlined" component="li" sx={{ listStyle: 'none', position: 'relative' }}>
      <CardActionArea component={RouterLink} to={def.to} sx={{ p: 2.25, display: 'flex', alignItems: 'flex-start', gap: 1.5, height: '100%' }}>
        <Box
          aria-hidden
          sx={(theme) => ({
            display: 'grid',
            placeItems: 'center',
            width: 40,
            height: 40,
            flexShrink: 0,
            borderRadius: 1.5,
            color: `${def.color}.main`,
            bgcolor: theme.alpha((theme.vars ?? theme).palette[def.color].main, 0.12),
          })}
        >
          <Icon />
        </Box>
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography variant="body2" color="text.secondary">
            {label}
          </Typography>
          {loading || !value ? (
            <>
              <Box component="span" role="status" sx={visuallyHidden}>
                {tCommon('shell.loading')}
              </Box>
              <Skeleton width={64} height={40} />
            </>
          ) : (
            <>
              <Typography variant="h4" component="p" data-summary={def.key} sx={{ fontWeight: 600, lineHeight: 1.3 }}>
                {formatNumber(value.total, language)}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {t('summary.activeCount', { value: formatNumber(value.active, language) })}
              </Typography>
            </>
          )}
        </Box>
      </CardActionArea>
      {/* Keyboard-focusable so the explanation is reachable without a mouse. */}
      <Tooltip title={t(`summary.${def.key}.hint`)}>
        <Box component="span" tabIndex={0} role="img" aria-label={t(`summary.${def.key}.hint`)} sx={{ position: 'absolute', top: 12, right: 12, display: 'inline-flex', color: 'text.secondary', borderRadius: '50%' }}>
          <InfoOutlined fontSize="small" />
        </Box>
      </Tooltip>
    </Paper>
  );
}

function TopLevelDepartments() {
  const { t } = useTranslation('organization');
  const { t: tCommon } = useTranslation();
  const { language } = useLanguage();
  const query = useDepartmentHierarchy();
  const roots = useMemo(() => buildTree(query.data ?? [], language), [query.data, language]);

  return (
    <Panel
      title={t('overview.structureTitle')}
      subtitle={t('overview.structureSubtitle')}
      actions={
        <Button component={RouterLink} to={orgPaths.hierarchy} size="small" startIcon={<AccountTreeOutlined />}>
          {t('overview.viewHierarchy')}
        </Button>
      }
    >
      {query.isError ? (
        <Alert
          severity="error"
          action={
            <Button color="inherit" size="small" onClick={() => void query.refetch()}>
              {tCommon('actions.retry')}
            </Button>
          }
        >
          {t('list.loadError')}
        </Alert>
      ) : (
        <TableContainer>
          <Table size="small" aria-label={t('overview.structureTitle')}>
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 600 }}>{t('fields.department')}</TableCell>
                <TableCell sx={{ fontWeight: 600, display: { xs: 'none', sm: 'table-cell' } }}>{t('fields.manager')}</TableCell>
                <TableCell sx={{ fontWeight: 600, display: { xs: 'none', md: 'table-cell' } }} align="right">
                  {t('fields.subdepartments')}
                </TableCell>
                <TableCell sx={{ fontWeight: 600 }} align="right">
                  {t('fields.employees')}
                </TableCell>
                <TableCell sx={{ fontWeight: 600 }}>{t('fields.status')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {query.isPending && (
                <TableRow>
                  <TableCell colSpan={5}>
                    <Box component="span" role="status" sx={visuallyHidden}>
                      {tCommon('shell.loading')}
                    </Box>
                    <Skeleton height={120} variant="rounded" />
                  </TableCell>
                </TableRow>
              )}
              {roots.map((d) => (
                <TableRow key={d.id} hover>
                  <TableCell>
                    <Link component={RouterLink} to={orgPaths.department(d.id)} sx={{ fontWeight: 500 }}>
                      {d.name[language]}
                    </Link>
                  </TableCell>
                  <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' } }}>{d.manager?.name[language] ?? t('overview.noManager')}</TableCell>
                  <TableCell sx={{ display: { xs: 'none', md: 'table-cell' } }} align="right">
                    {formatNumber(d.children.length, language)}
                  </TableCell>
                  <TableCell align="right">{formatNumber(d.totalEmployees, language)}</TableCell>
                  <TableCell>
                    <StatusChip status={d.status} />
                  </TableCell>
                </TableRow>
              ))}
              {query.data && roots.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5}>
                    <Typography color="text.secondary" sx={{ py: 3, textAlign: 'center' }}>
                      {t('hierarchy.empty')}
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Panel>
  );
}
