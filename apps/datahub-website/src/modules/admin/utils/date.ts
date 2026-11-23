const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * The backend's UTC date-time "2026-11-19T13:36:16.927Z" → "Nov 19, 2026 · 13:36" (UTC: parsed from the text, never
 * shifted by the viewer's timezone — the column says UTC).
 */
export function formatAdminDate(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return `${MONTHS[(m ?? 1) - 1]} ${d}, ${y} · ${iso.slice(11, 16)}`;
}

/** Epoch milliseconds → local "HH:MM" (the viewer's own clock, e.g. when the sign-in ends). */
export function formatLocalTime(epochMs: number): string {
  const date = new Date(epochMs);
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}
