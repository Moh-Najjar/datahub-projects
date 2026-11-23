import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardActionArea from '@mui/material/CardActionArea';
import Skeleton from '@mui/material/Skeleton';
import Typography from '@mui/material/Typography';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink } from 'react-router-dom';
import { formatDate, formatNumber } from '@/i18n/format';
import { FORMAT_LOCALE } from '@/i18n/languages';
import { useLanguage } from '@/i18n/useLanguage';
import { Panel } from '@/modules/shared/Panel';
import { useSettingsOverview } from '@/modules/settings/hooks/useSettings';
import { useSettingsAccess } from '@/modules/settings/hooks/useSettingsAccess';
import { settingsPaths } from '@/modules/settings/paths';
import { SETTINGS_CATEGORIES } from '@/modules/settings/types/settings';
import { QueryState } from './common/Facts';

/** `/settings`: key values, the fourteen categories and the latest changes. */
export function SettingsHome() {
  const { t } = useTranslation('settings');
  const { language } = useLanguage();
  const access = useSettingsAccess();
  const query = useSettingsOverview();
  const o = query.data;
  const day = (d: number) => new Intl.DateTimeFormat(FORMAT_LOCALE[language], { weekday: 'short' }).format(new Date(2026, 10, 15 + d));
  const tiles = o
    ? [
        { key: 'companyName', value: o.companyName[language] },
        { key: 'currency', value: o.defaultCurrency, ltr: true },
        { key: 'language', value: t(`localization.languageNames.${o.defaultLanguage}`) },
        { key: 'timezone', value: o.timezone, ltr: true },
        { key: 'workingWeek', value: o.workDays.map(day).join(' · ') },
        { key: 'holidays', value: formatNumber(o.activeHolidays, language) },
        { key: 'session', value: t('overview.hours', { value: formatNumber(o.sessionHours, language) }) },
        { key: 'notifications', value: formatNumber(o.notificationsEnabled, language) },
      ]
    : null;
  return (
    <Box sx={{ display: 'grid', gap: 2.5, gridTemplateColumns: 'minmax(0, 1fr)' }}>
      <QueryState query={query}>
        <Box component="dl" aria-label={t('overview.label')} sx={{ m: 0, display: 'grid', gap: 1.5, gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', md: 'repeat(4, minmax(0, 1fr))' } }}>
          {(tiles ?? Array.from({ length: 8 }, (_, i) => ({ key: String(i), value: '', ltr: false }))).map((tile) => (
            <Box key={tile.key} sx={{ p: 1.5, border: 1, borderColor: 'divider', borderRadius: 1, bgcolor: 'background.paper', minWidth: 0 }}>
              {tiles ? (
                <>
                  <Typography component="dt" variant="body2" color="text.secondary">
                    {t(`overview.${tile.key as 'currency'}`)}
                  </Typography>
                  <Typography component="dd" variant="subtitle1" sx={{ m: 0, fontWeight: 600, overflowWrap: 'anywhere' }} dir={'ltr' in tile && tile.ltr ? 'ltr' : undefined}>
                    {tile.value}
                  </Typography>
                </>
              ) : (
                <Skeleton />
              )}
            </Box>
          ))}
        </Box>
      </QueryState>
      <Box component="nav" aria-label={t('overview.categoriesLabel')} sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: 'repeat(2, minmax(0, 1fr))', lg: 'repeat(3, minmax(0, 1fr))' } }}>
        {SETTINGS_CATEGORIES.filter(access.visible).map((c) => (
          <Card key={c} variant="outlined" sx={{ minWidth: 0 }}>
            <CardActionArea component={RouterLink} to={settingsPaths.category(c)} sx={{ p: 2, height: '100%', alignItems: 'flex-start', display: 'flex', flexDirection: 'column' }}>
              <Typography variant="subtitle1" component="h2" sx={{ fontWeight: 600 }}>
                {t(`categories.${c}.title`)}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                {t(`categories.${c}.description`)}
              </Typography>
            </CardActionArea>
          </Card>
        ))}
      </Box>
      <Panel title={t('overview.recent')} actions={<Button component={RouterLink} to={settingsPaths.category('audit')} size="small">{t('overview.viewAudit')}</Button>}>
        {o && o.recentChanges.length === 0 ? (
          <Typography color="text.secondary">{t('overview.noRecent')}</Typography>
        ) : (
          <Box component="ul" sx={{ m: 0, p: 0, listStyle: 'none', display: 'grid', gap: 1 }}>
            {(o?.recentChanges ?? []).map((a) => (
              <Box component="li" key={a.id} sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'baseline' }}>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  <bdi dir="ltr">{a.target.startsWith('holiday:') ? a.targetLabel[language] : a.target}</bdi>
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {t(`audit.actions.${a.action}`)} · {a.actor.name[language]} · {formatDate(a.at, language, { dateStyle: 'medium', timeStyle: 'short' })}
                </Typography>
              </Box>
            ))}
          </Box>
        )}
      </Panel>
    </Box>
  );
}
