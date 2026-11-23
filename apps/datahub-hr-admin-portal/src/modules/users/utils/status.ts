import type { AccountStatus } from '@/modules/users/types/users';

export const STATUS_COLOR: Record<AccountStatus, 'success' | 'default' | 'warning'> = { active: 'success', inactive: 'default', suspended: 'warning' };
