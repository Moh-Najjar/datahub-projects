import Avatar from '@mui/material/Avatar';
import { initialsOf } from '@/modules/shared/utils/initials';

/** Initials avatar in the brand colour (as in the HR Admin Portal). Decorative (the name is always shown next to it). */
export function UserAvatar({ name, size = 36 }: { name: string; size?: number }) {
  return (
    <Avatar aria-hidden sx={{ width: size, height: size, fontSize: size * 0.38, fontWeight: 700, bgcolor: 'primary.main', color: 'primary.contrastText' }}>
      {initialsOf(name)}
    </Avatar>
  );
}
