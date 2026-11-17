const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "2026-11-09T10:21:42" → "Nov 9, 2026 · 10:21" (parsed manually: never shifted by the viewer's timezone). */
export function formatAdminDate(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return `${MONTHS[(m ?? 1) - 1]} ${d}, ${y} · ${iso.slice(11, 16)}`;
}
