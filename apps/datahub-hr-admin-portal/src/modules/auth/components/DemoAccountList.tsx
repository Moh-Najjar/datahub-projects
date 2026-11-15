import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Typography from '@mui/material/Typography';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '@/i18n/useLanguage';
import { useDemoAccounts } from '@/modules/auth/hooks/useLogin';

/** One-click sign-in as each fictional demo user (one per role). */
export function DemoAccountList({ onSelect, pending }: { onSelect: (email: string) => void; pending: boolean }) {
  const { t } = useTranslation('auth');
  const { t: tc } = useTranslation();
  const { language } = useLanguage();
  const { data: accounts, isPending, isError, refetch } = useDemoAccounts();

  if (isPending) {
    return (
      <Box role="status" sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'text.secondary' }}>
        <CircularProgress size={18} />
        <Typography variant="body2">{t('login.loadingAccounts')}</Typography>
      </Box>
    );
  }

  if (isError) {
    return (
      <Button variant="text" onClick={() => void refetch()}>
        {tc('actions.retry')}
      </Button>
    );
  }

  return (
    <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0, display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1 }}>
      {accounts.map((account) => (
        <li key={account.id}>
          <Button
            variant="outlined"
            fullWidth
            disabled={pending}
            onClick={() => onSelect(account.email)}
            aria-label={t('login.signInAs', { role: tc(`roles.${account.role}`) })}
            sx={{ justifyContent: 'flex-start', textAlign: 'start', py: 1, flexDirection: 'column', alignItems: 'flex-start' }}
          >
            <Typography component="span" variant="body2" sx={{ fontWeight: 600 }}>
              {tc(`roles.${account.role}`)}
            </Typography>
            <Typography component="span" variant="caption" color="text.secondary">
              {account.name[language]}
            </Typography>
          </Button>
        </li>
      ))}
    </Box>
  );
}
