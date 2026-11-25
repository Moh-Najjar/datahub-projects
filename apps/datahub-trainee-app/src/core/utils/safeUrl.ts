/**
 * A web address that is safe to open in a new tab: `http(s)` only (never `javascript:`, `data:` …). A bare domain
 * (`www.example.com`) gets `https://`. Anything else → `null`, so the UI shows it as plain text instead of a link that
 * would open this app again (an empty `href` points at the current page).
 */
export function safeHttpUrl(value: string | null | undefined): string | null {
  const text = value?.trim();
  if (!text) return null;
  const candidate = /^[a-z][a-z\d+.-]*:/i.test(text) ? text : /^[\w-]+(\.[\w-]+)+([/?#:].*)?$/.test(text) ? `https://${text}` : null;
  if (!candidate) return null;
  try {
    const url = new URL(candidate);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : null;
  } catch {
    return null;
  }
}
