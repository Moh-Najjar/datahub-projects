import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Skeleton from '@mui/material/Skeleton';
import Typography from '@mui/material/Typography';
import { useTranslation } from 'react-i18next';
import { formatDate } from '@/i18n/format';
import { useLanguage } from '@/i18n/useLanguage';
import { Panel } from '@/modules/shared/Panel';
import { visuallyHidden } from '@/modules/shared/styles';
import { useEmploymentHistory } from '@/modules/employees/hooks/useEmployees';
import type { EmploymentHistoryEntry } from '@/modules/employees/types/employee';

/** Employment changes, newest first, as a vertical timeline (an employee's history, not an audit log). */
export function HistorySection({ employeeId }: { employeeId: string }) {
  const { t } = useTranslation('employees');
  const { t: tCommon } = useTranslation();
  const { language } = useLanguage();
  const query = useEmploymentHistory(employeeId);

  /** Status changes carry status keys; other changes carry names. */
  const value = (entry: EmploymentHistoryEntry, v: EmploymentHistoryEntry['from']) => {
    if (!v) return t('history.none');
    return entry.type === 'status-changed' ? t(`status.${v.en as 'active' | 'inactive'}`) : v[language];
  };
  const change = (entry: EmploymentHistoryEntry) =>
    entry.from || entry.type !== 'joined' ? t('history.fromTo', { from: value(entry, entry.from), to: value(entry, entry.to) }) : t('history.to', { to: value(entry, entry.to) });

  let body;
  if (query.isPending) {
    body = (
      <Box>
        <Box component="span" role="status" sx={visuallyHidden}>
          {tCommon('shell.loading')}
        </Box>
        <Skeleton variant="rounded" height={140} />
      </Box>
    );
  } else if (query.isError) {
    body = (
      <Alert severity="error" action={<Button color="inherit" size="small" onClick={() => void query.refetch()}>{tCommon('actions.retry')}</Button>}>
        {tCommon('list.loadError')}
      </Alert>
    );
  } else if (query.data.length === 0) {
    body = <Typography color="text.secondary">{t('history.empty')}</Typography>;
  } else {
    body = (
      <Box component="ol" aria-label={t('history.title')} sx={{ listStyle: 'none', m: 0, p: 0 }}>
        {query.data.map((entry, i) => (
          <Box
            component="li"
            key={entry.id}
            data-history={entry.type}
            sx={{
              position: 'relative',
              pl: 3.5,
              pb: i === query.data.length - 1 ? 0 : 2.5,
              // Timeline rail and dot (physical left: mirrored in RTL by the theme).
              '&::before': { content: '""', position: 'absolute', left: 7, top: 6, bottom: 0, width: '2px', bgcolor: 'divider', display: i === query.data.length - 1 ? 'none' : 'block' },
              '&::after': { content: '""', position: 'absolute', left: 2, top: 4, width: 12, height: 12, borderRadius: '50%', bgcolor: entry.type === 'joined' ? 'success.main' : 'primary.main' },
            }}
          >
            <Typography variant="caption" color="text.secondary" component="p">
              {formatDate(entry.date, language)}
            </Typography>
            <Typography sx={{ fontWeight: 500 }}>{t(`history.types.${entry.type}`)}</Typography>
            <Typography variant="body2" color="text.secondary">
              {change(entry)}
            </Typography>
          </Box>
        ))}
      </Box>
    );
  }

  return <Panel title={t('history.title')}>{body}</Panel>;
}
