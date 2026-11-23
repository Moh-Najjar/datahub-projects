import { useMemo, useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import ButtonBase from '@mui/material/ButtonBase';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import IconButton from '@mui/material/IconButton';
import LinearProgress from '@mui/material/LinearProgress';
import Link from '@mui/material/Link';
import Paper from '@mui/material/Paper';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';
import ChevronLeft from '@mui/icons-material/ChevronLeft';
import ChevronRight from '@mui/icons-material/ChevronRight';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink } from 'react-router-dom';
import { useAuth } from '@/core/context/authContext';
import { FORMAT_LOCALE } from '@/i18n/languages';
import { useLanguage } from '@/i18n/useLanguage';
import { useDepartmentOptions } from '@/modules/organization';
import { FilterSelect } from '@/modules/shared/ListToolbar';
import type { CalendarFilters } from '@/modules/leave/api/leaveApi';
import { useLeaveCalendar, useLeaveTypes } from '@/modules/leave/hooks/useLeave';
import { leavePaths } from '@/modules/leave/paths';
import type { CalendarEntry } from '@/modules/leave/types/leave';
import { formatDay, formatMonthKey, formatRange, todayIso } from '@/modules/leave/utils/format';
import { addDays, datesBetween } from '@/modules/leave/utils/rules';

const MAX_PER_DAY = 3;

const shiftMonth = (month: string, delta: number) => {
  const [y, m] = month.split('-').map(Number) as [number, number];
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};
const lastDay = (month: string) => addDays(`${shiftMonth(month, 1)}-01`, -1);
const weekdayOf = (date: string) => new Date(`${date}T00:00`).getDay();

/**
 * Monthly leave calendar (approved and pending leave in the caller's scope), built from MUI parts — no calendar
 * dependency. Weeks start on Sunday; the grid mirrors itself in RTL. Phones get an agenda list instead of the grid.
 */
export function CalendarSection() {
  const { t } = useTranslation('leave');
  const { language } = useLanguage();
  const { can } = useAuth();
  const theme = useTheme();
  const compact = useMediaQuery(theme.breakpoints.down('md'));
  const [today] = useState(() => todayIso());
  const [month, setMonth] = useState(today.slice(0, 7));
  const [filters, setFilters] = useState<CalendarFilters>({});
  const query = useLeaveCalendar(month, filters);
  const types = useLeaveTypes({ page: 1, pageSize: 100, sortBy: `name.${language}`, sortDirection: 'asc' });
  const { options: departments } = useDepartmentOptions({ enabled: can('organization.departments.view') });
  const [openDay, setOpenDay] = useState<string | null>(null);
  const rtl = theme.direction === 'rtl';

  const days = useMemo(() => datesBetween(`${month}-01`, lastDay(month)), [month]);
  const byDay = useMemo(() => {
    const map = new Map<string, CalendarEntry[]>();
    for (const e of query.data ?? []) for (const d of datesBetween(e.startDate < days[0]! ? days[0]! : e.startDate, e.endDate > days.at(-1)! ? days.at(-1)! : e.endDate)) map.set(d, [...(map.get(d) ?? []), e]);
    return map;
  }, [query.data, days]);
  const weekdays = useMemo(() => {
    const fmt = new Intl.DateTimeFormat(FORMAT_LOCALE[language], { weekday: compact ? 'narrow' : 'short' });
    return Array.from({ length: 7 }, (_, i) => fmt.format(new Date(2026, 10, 1 + i))); // 1 Nov 2026 is a Sunday
  }, [language, compact]);
  const setFilter = (key: keyof CalendarFilters, value: string) => setFilters((f) => ({ ...f, [key]: value || undefined }));
  const PrevIcon = rtl ? ChevronRight : ChevronLeft;
  const NextIcon = rtl ? ChevronLeft : ChevronRight;

  return (
    <section aria-label={t('calendar.title')}>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 1.5, mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <IconButton onClick={() => setMonth(shiftMonth(month, -1))} aria-label={t('calendar.previous')}>
            <PrevIcon />
          </IconButton>
          <Typography variant="h6" component="h3" aria-live="polite" sx={{ minWidth: 150, textAlign: 'center' }}>
            {formatMonthKey(month, language)}
          </Typography>
          <IconButton onClick={() => setMonth(shiftMonth(month, 1))} aria-label={t('calendar.next')}>
            <NextIcon />
          </IconButton>
          <Button size="small" variant="outlined" onClick={() => setMonth(today.slice(0, 7))} disabled={month === today.slice(0, 7)}>
            {t('calendar.today')}
          </Button>
        </Box>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, flex: '1 1 320px', justifyContent: 'flex-end' }}>
          {departments.length > 0 && (
            <FilterSelect label={t('fields.department')} value={filters.departmentId ?? ''} onChange={(v) => setFilter('departmentId', v)} allLabel={t('filters.allDepartments')} options={departments.map((o) => ({ value: o.value, label: o.label, depth: o.depth }))} />
          )}
          <FilterSelect label={t('fields.leaveType')} value={filters.leaveTypeId ?? ''} onChange={(v) => setFilter('leaveTypeId', v)} allLabel={t('filters.allTypes')} options={(types.data?.items ?? []).map((x) => ({ value: x.id, label: x.name[language] }))} />
          <FilterSelect
            label={t('fields.status')}
            value={filters.status ?? ''}
            onChange={(v) => setFilter('status', v)}
            allLabel={t('calendar.approvedAndPending')}
            options={[
              { value: 'approved', label: t('status.approved') },
              { value: 'pending', label: t('status.pending') },
            ]}
          />
        </Box>
      </Box>
      <Box sx={{ display: 'flex', gap: 2, mb: 1.5, flexWrap: 'wrap' }}>
        <Legend tone="success" label={t('status.approved')} />
        <Legend tone="warning" label={t('status.pending')} dashed />
      </Box>
      {query.isFetching && <LinearProgress aria-label={t('calendar.loading')} sx={{ mb: 1 }} />}
      {query.isError ? (
        <Alert severity="error" action={<Button color="inherit" size="small" onClick={() => void query.refetch()}>{t('calendar.retry')}</Button>}>
          {t('calendar.loadError')}
        </Alert>
      ) : compact ? (
        <Agenda days={days} byDay={byDay} today={today} />
      ) : (
        <Paper variant="outlined" sx={{ overflow: 'hidden' }}>
          <Box role="grid" aria-label={formatMonthKey(month, language)} sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))' }}>
            <Box role="row" sx={{ display: 'contents' }}>
              {weekdays.map((w) => (
                <Box key={w} role="columnheader" sx={{ p: 1, textAlign: 'center', bgcolor: 'action.hover', borderBottom: 1, borderColor: 'divider' }}>
                  <Typography variant="caption" sx={{ fontWeight: 600 }}>
                    {w}
                  </Typography>
                </Box>
              ))}
            </Box>
            <Box role="row" sx={{ display: 'contents' }}>
              {Array.from({ length: weekdayOf(days[0]!) }, (_, i) => (
                <Box key={`pad-${i}`} role="gridcell" aria-hidden sx={{ borderBottom: 1, borderLeft: 1, borderColor: 'divider', bgcolor: 'action.hover', opacity: 0.4 }} />
              ))}
              {days.map((d) => {
                const entries = byDay.get(d) ?? [];
                const more = entries.length - MAX_PER_DAY;
                return (
                  <Box key={d} role="gridcell" aria-label={`${formatDay(d, language, { dateStyle: 'full' })}: ${t('calendar.entries', { count: entries.length })}`} sx={{ minHeight: 112, p: 0.75, borderBottom: 1, borderLeft: 1, borderColor: 'divider', minWidth: 0 }}>
                    <Typography variant="caption" component="div" sx={{ fontWeight: d === today ? 700 : 400, color: d === today ? 'primary.main' : 'text.secondary', mb: 0.5 }}>
                      {Number(d.slice(8))}
                    </Typography>
                    <Box sx={{ display: 'grid', gap: 0.5 }}>
                      {entries.slice(0, MAX_PER_DAY).map((e) => (
                        <EntryChip key={e.requestId} entry={e} />
                      ))}
                      {more > 0 && (
                        <ButtonBase onClick={() => setOpenDay(d)} sx={{ justifyContent: 'flex-start', px: 0.5, borderRadius: 1, typography: 'caption', color: 'primary.main' }}>
                          {t('calendar.more', { count: more })}
                        </ButtonBase>
                      )}
                    </Box>
                  </Box>
                );
              })}
            </Box>
          </Box>
        </Paper>
      )}
      {!query.isPending && !query.isError && (query.data?.length ?? 0) === 0 && (
        <Typography color="text.secondary" sx={{ mt: 2 }}>
          {t('calendar.empty')}
        </Typography>
      )}
      <Dialog open={openDay !== null} onClose={() => setOpenDay(null)} fullWidth maxWidth="xs" aria-labelledby="leave-day-title">
        <DialogTitle id="leave-day-title">{openDay ? formatDay(openDay, language, { dateStyle: 'full' }) : ''}</DialogTitle>
        <DialogContent dividers>
          <Box sx={{ display: 'grid', gap: 1 }}>
            {(openDay ? (byDay.get(openDay) ?? []) : []).map((e) => (
              <EntryChip key={e.requestId} entry={e} full />
            ))}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDay(null)}>{t('actions.close')}</Button>
        </DialogActions>
      </Dialog>
    </section>
  );
}

function Legend({ tone, label, dashed }: { tone: 'success' | 'warning'; label: string; dashed?: boolean }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
      <Box aria-hidden sx={(theme) => ({ width: 14, height: 14, borderRadius: 0.5, border: 2, borderStyle: dashed ? 'dashed' : 'solid', borderColor: `${tone}.main`, bgcolor: theme.alpha((theme.vars ?? theme).palette[tone].main, 0.16) })} />
      <Typography variant="caption">{label}</Typography>
    </Box>
  );
}

/** One leave in the calendar: name + type; colour AND border style tell approved from pending. Opens the request. */
function EntryChip({ entry: e, full = false }: { entry: CalendarEntry; full?: boolean }) {
  const { t } = useTranslation('leave');
  const { language } = useLanguage();
  const tone = e.status === 'approved' ? 'success' : 'warning';
  const label = `${e.name[language]} · ${e.leaveType.name[language]} · ${t(`status.${e.status}`)} · ${formatRange(e.startDate, e.endDate, language)}`;
  return (
    <Tooltip title={full ? '' : label}>
      <Link
        component={RouterLink}
        to={leavePaths.request(e.requestId)}
        underline="none"
        aria-label={label}
        sx={(theme) => ({
          display: 'block',
          px: 0.75,
          py: 0.25,
          borderRadius: 1,
          border: 1,
          borderStyle: e.status === 'pending' ? 'dashed' : 'solid',
          borderColor: `${tone}.main`,
          bgcolor: theme.alpha((theme.vars ?? theme).palette[tone].main, 0.12),
          color: 'text.primary',
          typography: 'caption',
          whiteSpace: full ? 'normal' : 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        })}
      >
        {full ? label : `${e.name[language]} · ${e.leaveType.code}`}
      </Link>
    </Tooltip>
  );
}

function Agenda({ days, byDay, today }: { days: string[]; byDay: Map<string, CalendarEntry[]>; today: string }) {
  const { language } = useLanguage();
  const withEntries = days.filter((d) => (byDay.get(d)?.length ?? 0) > 0);
  return (
    <Box component="ol" sx={{ listStyle: 'none', m: 0, p: 0, display: 'grid', gap: 1.5 }}>
      {withEntries.map((d) => (
        <Paper component="li" key={d} variant="outlined" sx={{ p: 1.5 }}>
          <Typography variant="subtitle2" component="h4" sx={{ mb: 1, color: d === today ? 'primary.main' : undefined }}>
            {formatDay(d, language, { weekday: 'long', day: 'numeric', month: 'long' })}
          </Typography>
          <Box sx={{ display: 'grid', gap: 0.5 }}>
            {byDay.get(d)!.map((e) => (
              <EntryChip key={e.requestId} entry={e} full />
            ))}
          </Box>
        </Paper>
      ))}
    </Box>
  );
}
