import Avatar from '@mui/material/Avatar';
import { useLanguage } from '@/i18n/useLanguage';
import type { PersonName } from '@/modules/employees/types/employee';
import { initials } from '@/modules/employees/utils/names';

const TONES = ['primary', 'secondary', 'success', 'info', 'warning'] as const;

/** Initials avatar (no photo storage yet). The colour is stable per employee; the name is announced elsewhere. */
export function EmployeeAvatar({ id, name, size = 36 }: { id: string; name: PersonName; size?: number }) {
  const { language } = useLanguage();
  const tone = TONES[[...id].reduce((sum, c) => sum + c.charCodeAt(0), 0) % TONES.length]!;
  return (
    <Avatar
      aria-hidden
      sx={(theme) => ({
        width: size,
        height: size,
        fontSize: size * 0.4,
        fontWeight: 600,
        color: (theme.vars ?? theme).palette[tone].main,
        bgcolor: theme.alpha((theme.vars ?? theme).palette[tone].main, 0.14),
      })}
    >
      {initials(name, language)}
    </Avatar>
  );
}
