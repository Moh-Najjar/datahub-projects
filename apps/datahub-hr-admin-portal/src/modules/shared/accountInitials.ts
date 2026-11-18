/** Up to two initials from a display name, used by avatars in the shell and profile. */
export function accountInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter((word) => word.length > 0)
    .slice(0, 2)
    .map((word) => word.charAt(0))
    .join('');
}
