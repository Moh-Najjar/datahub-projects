/**
 * Allowlist HTML/SVG sanitizers shared by the content scripts.
 * Content comes from the original site, but it is still rendered with
 * `dangerouslySetInnerHTML`, so only semantic tags and safe attributes survive.
 */

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', hellip: '…', ndash: '–', mdash: '—', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“' };

export const decodeEntities = (s: string) =>
  s
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n: string) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, name: string) => ENTITIES[name.toLowerCase()] ?? m);

const ALLOWED_TAGS = new Set(['p', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'strong', 'b', 'em', 'i', 'u', 'a', 'blockquote', 'br', 'hr', 'img', 'figure', 'figcaption', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'code', 'pre', 'sup', 'sub', 'mark', 'span']);
const ALLOWED_ATTRS: Record<string, string[]> = { a: ['href', 'title'], img: ['src', 'alt', 'width', 'height'], th: ['colspan', 'rowspan'], td: ['colspan', 'rowspan'] };

export interface SanitizeOptions {
  /** Rewrites link targets (e.g. to locale-neutral internal paths). */
  localLink?: (href: string) => string | undefined;
  /** Rewrites image sources (e.g. to downloaded local copies). */
  localAsset?: (src: string) => string | undefined;
}

/**
 * Keeps semantic tags and a few attributes; drops wrapper divs, classes, inline styles and
 * scripts. `h1` is downgraded to `h2` (pages have a single `h1`). `span` is unwrapped.
 */
export function sanitizeHtml(html: string, options: SanitizeOptions = {}): string {
  const cleaned = html.replace(/<(script|style|iframe|noscript|svg|button|form|select|textarea)[\s\S]*?<\/\1>/gi, '').replace(/<!--[\s\S]*?-->/g, '');
  const out = cleaned.replace(/<(\/?)([a-z0-9]+)([^>]*)>/gi, (_, close: string, rawTag: string, attrs: string) => {
    let tag = rawTag.toLowerCase();
    if (tag === 'h1') tag = 'h2';
    if (!ALLOWED_TAGS.has(tag) || tag === 'span') return '';
    if (close) return `</${tag}>`;
    const kept = (ALLOWED_ATTRS[tag] ?? [])
      .map((name) => {
        const m = attrs.match(new RegExp(`\\s${name}\\s*=\\s*("([^"]*)"|'([^']*)')`, 'i'));
        let value = m ? (m[2] ?? m[3] ?? '') : null;
        if (value === null) return '';
        if ((name === 'href' || name === 'src') && /^\s*javascript:/i.test(value)) return '';
        if (name === 'href' && options.localLink) value = options.localLink(value) ?? value;
        if (name === 'src' && options.localAsset) value = options.localAsset(value) ?? value;
        return ` ${name}="${value.replace(/"/g, '&quot;')}"`;
      })
      .join('');
    const external = tag === 'a' && /href="https?:\/\/(?!datahubanalytics\.com)/.test(kept);
    return `<${tag}${kept}${external ? ' target="_blank" rel="noopener noreferrer"' : ''}${tag === 'img' ? ' loading="lazy" decoding="async"' : ''}>`;
  });
  return out
    .replace(/<p>\s*(&nbsp;|\s)*<\/p>/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/** Keeps only SVG drawing elements and presentational attributes (theme line icons). */
export function sanitizeSvg(svg: string): string {
  const allowedTags = /^(svg|g|path|circle|ellipse|line|polyline|polygon|rect|defs|lineargradient|stop|title)$/i;
  return svg
    .replace(/<\?xml[\s\S]*?\?>|<!DOCTYPE[\s\S]*?>|<!--[\s\S]*?-->/gi, '')
    .replace(/<(script|style|foreignObject)[\s\S]*?<\/\1>/gi, '')
    .replace(/<(\/?)([a-zA-Z:]+)([^>]*?)(\/?)>/g, (_, close: string, tag: string, attrs: string, self: string) => {
      if (!allowedTags.test(tag)) return '';
      const safe = attrs.replace(/\s(on\w+|href|xlink:href)\s*=\s*("[^"]*"|'[^']*')/gi, '');
      return `<${close}${tag}${close ? '' : safe}${self}>`;
    })
    .trim();
}
