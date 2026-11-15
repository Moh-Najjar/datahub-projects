import { useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/core/context/authContext';
import { formatDate } from '@/i18n/format';
import { useLanguage } from '@/i18n/useLanguage';
import type { DashboardScope } from '@/modules/dashboard/types/dashboard';

const greetingKey = (hour: number) => (hour < 12 ? 'greeting.morning' : hour < 18 ? 'greeting.afternoon' : 'greeting.evening');

/** Greeting for the signed-in user, today's date and what the dashboard covers. The page's only h1. */
export function WelcomeHeader({ scope, date }: { scope: DashboardScope; date?: Date }) {
  const { t } = useTranslation('dashboard');
  // Taken once when the page opens (render stays pure); `date` lets tests fix the time of day.
  const [now] = useState(() => date ?? new Date());
  const { language } = useLanguage();
  const { user } = useAuth();
  if (!user) return null;

  return (
    <Box component="header" sx={{ mb: 3 }}>
      <Typography variant="body2" color="text.secondary" component="p">
        {formatDate(now, language, { dateStyle: 'full' })}
      </Typography>
      <Typography variant="h2" component="h1" sx={{ mt: 0.5 }}>
        {t(greetingKey(now.getHours()), { name: user.name[language] })}
      </Typography>
      <Typography color="text.secondary" sx={{ mt: 0.5 }}>
        {scope === 'team' && user.department ? t('description.team', { department: user.department[language] }) : t('description.organization')}
      </Typography>
    </Box>
  );
}
