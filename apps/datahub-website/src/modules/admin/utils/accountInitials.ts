/** Up to two initials from a display name. */
export function accountInitials(name: string): string {
  const parts = name.split(' ').filter((part) => part.length > 0);
  const first = parts[0]?.charAt(0) ?? '';
  const second = parts.length > 1 ? (parts[1]?.charAt(0) ?? '') : '';
  return `${first}${second}`.toUpperCase();
}
