/**
 * Converts the original site's WPBakery pages into typed JSON page documents
 * (`src/features/page-blocks/types/blocks.ts`) — real content, real assets, real computed styles.
 *
 * For every page (and its Arabic translation when one exists) it:
 *  1. loads the live page in Chromium at 1440px and walks the WPBakery DOM
 *     (rows → columns → theme widgets) into a tree;
 *  2. re-measures the same elements at 800px and 390px for responsive styles;
 *  3. rewrites links to locale-neutral paths and downloads every referenced
 *     image/SVG into `public/assets/uploads/` (mirroring the original paths).
 *
 * Output: src/content/pages/<routeKey>.<locale>.json
 * Usage:  node scripts/convert-pages.ts [routeKey ...]
 */
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { chromium, type Page } from 'playwright';
import { sanitizeHtml, sanitizeSvg } from './lib/sanitize.ts';

const ROOT = join(import.meta.dirname, '..');
const ORIGIN = 'https://datahubanalytics.com';
const OUT_DIR = join(ROOT, 'src', 'content', 'pages');
const PUBLIC = join(ROOT, 'public');
const WIDTHS = { xl: 1440, md: 800, xs: 390 } as const;

/* Pages rendered by dedicated React components instead of block documents. */
const SKIP = new Set(['home']);

type StyleMap = Record<string, string>;
interface Captured {
  tree: unknown;
  keys: number;
}

/* ------------------------------------------------------------------ registry */

async function loadRegistry(): Promise<Array<{ key: string; path: string; locales: string[] }>> {
  const routesSrc = await readFile(join(ROOT, 'src', 'shared', 'config', 'routes.ts'), 'utf8');
  const pagesSrc = await readFile(join(ROOT, 'src', 'shared', 'config', 'pages.ts'), 'utf8');
  const routes = [...routesSrc.matchAll(/^\s+(\w+): '(\/[^']*)',/gm)].map((m) => ({ key: m[1]!, path: m[2]! }));
  return routes.map((r) => {
    const block = pagesSrc.match(new RegExp(`\\n  ${r.key}: \\{\\n    locales: \\[([^\\]]*)\\]`));
    const locales = block ? [...block[1]!.matchAll(/'(\w+)'/g)].map((m) => m[1]!) : ['en'];
    return { ...r, locales };
  });
}

/* ------------------------------------------------------------ browser walker */

/**
 * Runs inside the page. Walks the WPBakery content, tagging every element whose
 * computed style we need with `data-ck`, and returns the structural tree.
 * (Self-contained: it is serialized into the browser.)
 */
function walkPage(): Captured {
  let counter = 0;
  const key = (el: Element | null, role: string): string | undefined => {
    if (!el) return undefined;
    const k = `${role}:${counter++}`;
    el.setAttribute(`data-ck-${role}`, k);
    el.setAttribute('data-ck', [el.getAttribute('data-ck'), k].filter(Boolean).join(' '));
    return k;
  };
  const txt = (el: Element | null) => (el ? (el as HTMLElement).innerText.replace(/\s+/g, ' ').trim() : '');
  const rich = (el: Element | null): unknown => {
    if (!el) return '';
    const parts: Array<string | { mark: string }> = [];
    el.childNodes.forEach((n) => {
      if (n.nodeType === Node.TEXT_NODE) parts.push(n.textContent ?? '');
      else if ((n as Element).tagName === 'MARK') parts.push({ mark: (n.textContent ?? '').replace(/\s+/g, ' ') });
      else if ((n as Element).tagName === 'BR') parts.push(' ');
      else parts.push((n as HTMLElement).innerText ?? n.textContent ?? '');
    });
    const norm = parts
      .map((p) => (typeof p === 'string' ? p.replace(/\s+/g, ' ') : p))
      .filter((p) => (typeof p === 'string' ? p.length > 0 : p.mark.trim().length > 0))
      .reduce<Array<string | { mark: string }>>((acc, p) => {
        const prev = acc[acc.length - 1];
        if (typeof p === 'string' && typeof prev === 'string') acc[acc.length - 1] = `${prev}${p}`.replace(/\s+/g, ' ');
        else acc.push(p);
        return acc;
      }, []);
    if (norm.length && typeof norm[0] === 'string') norm[0] = (norm[0] as string).trimStart();
    const last = norm.length - 1;
    if (last >= 0 && typeof norm[last] === 'string') norm[last] = (norm[last] as string).trimEnd();
    if (norm.every((p) => typeof p === 'string')) return (norm as string[]).join('');
    return norm;
  };
  const img = (el: Element | null) => {
    if (!el) return undefined;
    const i = el as HTMLImageElement;
    const src = i.getAttribute('data-src') || i.getAttribute('data-lazy-src') || i.getAttribute('src') || '';
    return { src, alt: i.getAttribute('alt') || '', width: Number(i.getAttribute('width')) || i.naturalWidth, height: Number(i.getAttribute('height')) || i.naturalHeight };
  };
  const href = (el: Element | null) => (el ? (el.closest('a') ?? el.querySelector('a'))?.getAttribute('href') ?? undefined : undefined);
  const button = (a: Element) => {
    const cls = a.className;
    const icon = a.querySelector('.button-icon i, i');
    const iconCls = icon?.className ?? '';
    return {
      label: txt(a.querySelector('.button-text') ?? a),
      href: a.getAttribute('href') ?? undefined,
      variant: /style-text/.test(cls) ? 'text' : /style-outline|style-border/.test(cls) ? 'outline' : /vc_btn3-style-gradient/.test(cls) ? 'gradient' : 'flat',
      icon: !iconCls ? null : /phone/.test(iconCls) ? 'phone' : /map/.test(iconCls) ? 'map' : /download/.test(iconCls) ? 'download' : 'arrow',
      iconPosition: /icon-left/.test(cls) ? 'left' : 'right',
      style: key(a, 'button'),
      newTab: a.getAttribute('target') === '_blank',
    };
  };
  const parts = (root: Element, map: Record<string, string>) => {
    const out: Record<string, string | undefined> = {};
    for (const [name, sel] of Object.entries(map)) {
      const el = sel === ':scope' ? root : root.querySelector(sel);
      if (el) out[name] = key(el, name === 'root' || name === 'wrap' || name === 'card' ? 'box' : /image|img/.test(name) ? 'img' : 'text');
    }
    return out;
  };
  const columnWidths = (cls: string) => {
    const w: Record<string, number> = {};
    const o: Record<string, number> = {};
    const bp: Record<string, string> = { xs: 'xs', sm: 'md', md: 'lg', lg: 'xl' };
    for (const m of cls.matchAll(/vc_col-(xs|sm|md|lg)-(offset-)?(\d+)(?:\/(\d+))?/g)) {
      const value = m[4] ? (12 * Number(m[3])) / Number(m[4]) : Number(m[3]);
      (m[2] ? o : w)[bp[m[1]!]!] = value;
    }
    return { w, o };
  };
  const warnings: string[] = [];
  /** Skips layout-only wrappers (Swiper slides, grid items) down to the actual widget. */
  const unwrap = (el: Element): Element => {
    let cur = el;
    while (/\b(swiper-slide|swiper-slide-inner|grid-item)\b/.test(cur.className) && cur.firstElementChild) cur = cur.firstElementChild;
    return cur;
  };

  const block = (el: Element): unknown | null => {
    const c = el.className && typeof el.className === 'string' ? el.className : '';
    if (/\btm-spacer\b/.test(c)) return { kind: 'spacer', height: key(el, 'spacer') };
    if (/\btm-heading\b/.test(c)) {
      const h = el.querySelector('.heading');
      if (!h) return null;
      return { kind: 'heading', tag: h.tagName.toLowerCase(), text: rich(h), style: key(h, 'text'), markStyle: key(h.querySelector('mark'), 'text'), link: href(h.querySelector('a')) };
    }
    if (/\bwpb_text_column\b/.test(c) || /\bwpb_raw_html\b/.test(c)) {
      const w = el.querySelector('.wpb_wrapper') ?? el;
      return { kind: 'text', html: w.innerHTML, style: key(w.querySelector('p, li, div') ?? w, 'text') };
    }
    if (/\btm-button-group\b|\btm-button-wrapper\b|\bvc_btn3-container\b/.test(c)) {
      const as = [...el.querySelectorAll('a.tm-button, a.vc_btn3, a.vc_general')];
      return { kind: 'buttons', buttons: as.map(button), align: getComputedStyle(el).textAlign };
    }
    if (/\btm-image\b/.test(c) || /\bwpb_single_image\b/.test(c)) {
      const i = el.querySelector('img');
      if (!i) return null;
      return { kind: 'image', image: img(i), href: href(i), style: key(el, 'box'), imageStyle: key(i, 'img') };
    }
    if (/\btm-box-icon\b|\btm-box-image\b|\btm-box-large-image\b/.test(c)) {
      const variant = `${c.match(/tm-box-(icon|image|large-image)/)![1]}-${c.match(/style-(\d+)/)?.[1] ?? '01'}`;
      const svgHost = el.querySelector('.tm-svg');
      const fontIcon = el.querySelector('.icon i, .icon span[class*="fa"]');
      const btn = el.querySelector('a.tm-button, .btn, .tm-box-button');
      return {
        kind: 'box',
        variant,
        href: el.querySelector('a.link-secret, a.tm-box-link')?.getAttribute('href') ?? (btn ? undefined : href(el.querySelector('.heading'))),
        image: img(el.querySelector('.image img, .images img, img')),
        svg: svgHost?.getAttribute('data-svg') ?? undefined,
        icon: fontIcon?.className ?? undefined,
        heading: rich(el.querySelector('.heading')),
        subHeading: txt(el.querySelector('.sub-heading')) || undefined,
        // Keep paragraphs/bold: sanitized on the Node side (see `textHtml` in resolve()).
        textHtml: (el.querySelector('.text') as HTMLElement | null)?.innerHTML.trim() || undefined,
        button: btn ? { ...button(btn), href: btn.getAttribute('href') ?? btn.closest('a')?.getAttribute('href') ?? undefined } : undefined,
        style: key(el, 'box'),
        parts: parts(el, { wrap: '.content-wrap', image: '.image, .images', icon: '.icon', heading: '.heading', subHeading: '.sub-heading', text: '.text', content: '.content', btnText: '.btn, .tm-button' }),
      };
    }
    if (/\btm-list\b/.test(c)) {
      const variant = c.match(/style-([\w-]+)/)?.[1] ?? 'check';
      const items = [...el.querySelectorAll('.item, .list-item')].map((it) => ({
        title: txt(it.querySelector('.title')) || undefined,
        text: txt(it.querySelector('.desc, .text')) || undefined,
        href: it.querySelector('a')?.getAttribute('href') ?? undefined,
        number: txt(it.querySelector('.marker')) || undefined,
      }));
      const first = el.querySelector('.item, .list-item');
      return {
        kind: 'list',
        variant,
        items,
        style: key(el, 'box'),
        // Lists can be laid out in columns (CSS grid on the items' container).
        columns: first?.parentElement ? key(first.parentElement, 'grid') : undefined,
        parts: first ? parts(first, { item: ':scope', marker: '.marker', title: '.title', text: '.desc, .text' }) : {},
      };
    }
    if (/\btm-accordion\b/.test(c)) {
      const sections = [...el.querySelectorAll('.accordion-section')];
      const first = sections[0];
      return {
        kind: 'accordion',
        items: sections.map((s) => ({ title: txt(s.querySelector('.accordion-title')), html: (s.querySelector('.accordion-content') as HTMLElement | null)?.innerHTML ?? '' })),
        style: key(el, 'box'),
        parts: first ? parts(first, { section: ':scope', title: '.accordion-title', content: '.accordion-content' }) : {},
      };
    }
    if (/\bvc_tta-container\b|\btm-tta-container\b/.test(c) && el.querySelector('.vc_tta-panel')) {
      const panels = [...el.querySelectorAll('.vc_tta-panel')];
      const tab = el.querySelector('.vc_tta-tab a, .vc_tta-panel-title a');
      return {
        kind: 'tabs',
        tabs: panels.map((p) => ({
          title: txt(p.querySelector('.vc_tta-panel-title .vc_tta-title-text')) || txt(el.querySelector(`.vc_tta-tab a[href="#${p.id}"] .vc_tta-title-text`)),
          children: walkChildren(p.querySelector('.vc_tta-panel-body')),
        })),
        parts: tab ? { tab: key(tab, 'box') } : {},
      };
    }
    if (/\btm-counter\b/.test(c)) {
      return {
        kind: 'counter',
        value: Number(txt(el.querySelector('.number')).replace(/[^\d.]/g, '')) || 0,
        prefix: txt(el.querySelector('.number-prefix')),
        suffix: txt(el.querySelector('.number-suffix')),
        label: txt(el.querySelector('.heading')),
        parts: parts(el, { number: '.number-wrap', label: '.heading' }),
      };
    }
    if (/\btm-grid-wrapper\b/.test(c)) {
      if (/\btm-blog\b/.test(c) || el.querySelector('.tm-blog, .post-item')) return { kind: 'blogGrid' };
      const grid = el.querySelector('.tm-grid') ?? el;
      const gallery = /tm-light-gallery|tm-gallery/.test(grid.className) && !grid.querySelector('.tm-box-icon, .tm-box-image, .tm-box-large-image');
      if (gallery) return { kind: 'gallery', images: [...grid.querySelectorAll('img')].map(img), columns: key(grid, 'grid'), gap: key(grid, 'grid') };
      return { kind: 'grid', columns: key(grid, 'grid'), gap: key(grid, 'grid'), children: [...grid.children].map((it) => block(unwrap(it))).filter(Boolean) };
    }
    if (/\btm-gallery\b/.test(c)) {
      const grid = el.querySelector('.tm-grid, .modern-grid') ?? el;
      return { kind: 'gallery', images: [...el.querySelectorAll('img')].map(img), columns: key(grid, 'grid'), gap: key(grid, 'grid') };
    }
    if (/\btm-slider-group\b/.test(c)) {
      const d = (el as HTMLElement).dataset;
      return {
        kind: 'slider',
        perView: { xs: Number(d.xsItems ?? 1), sm: Number(d.smItems ?? d.xsItems ?? 1), md: Number(d.mdItems ?? d.smItems ?? 1), lg: Number(d.lgItems ?? 3) },
        autoplay: Number(d.autoplay ?? 0),
        children: [...el.querySelectorAll('.swiper-wrapper > *')].map((s) => block(unwrap(s))).filter(Boolean),
      };
    }
    if (/\btm-client\b/.test(c)) {
      const s = el.querySelector('.tm-swiper') as HTMLElement | null;
      const d = s?.dataset ?? {};
      return {
        kind: 'clients',
        images: [...el.querySelectorAll('img')].map(img),
        perView: { xs: Number(d.xsItems ?? 2), sm: Number(d.smItems ?? 3), md: Number(d.mdItems ?? 4), lg: Number(d.lgItems ?? 6) },
        autoplay: Number(d.autoplay ?? 1000),
      };
    }
    if (/\btm-popup-video\b/.test(c)) {
      return { kind: 'video', poster: img(el.querySelector('img')), videoUrl: el.querySelector('a')?.getAttribute('href') ?? '' };
    }
    if (/\btm-gradation\b/.test(c)) {
      const items = [...el.querySelectorAll('.item')];
      return {
        kind: 'gradation',
        items: items.map((it) => ({ heading: txt(it.querySelector('.heading')), text: txt(it.querySelector('.text')) })),
        parts: items[0] ? parts(items[0], { heading: '.heading', text: '.text', count: '.count, .number' }) : {},
      };
    }
    if (/\bvc_separator\b/.test(c)) return { kind: 'separator', style: key(el.querySelector('.vc_sep_line') ?? el, 'box') };
    if (/\btm-contact-form-7\b|\bwpcf7\b/.test(c)) {
      const ph = (sel: string) => el.querySelector(sel)?.getAttribute('placeholder') ?? undefined;
      const options = [...el.querySelectorAll('select[name="inquiry"] option')].map((o) => o.textContent?.trim() ?? '');
      return {
        kind: 'contactForm',
        namePlaceholder: ph('input[name="your-name"]'),
        emailPlaceholder: ph('input[name="your-email"]'),
        messagePlaceholder: ph('textarea[name="your-message"]'),
        inquiryPlaceholder: options[0],
        inquiryOptions: options.slice(1),
        submitLabel: el.querySelector('input[type="submit"]')?.getAttribute('value') ?? undefined,
        submitStyle: key(el.querySelector('input[type="submit"]'), 'button'),
      };
    }
    if (/\btm-popup-map\b/.test(c)) {
      const a = el.querySelector('a');
      return { kind: 'map', label: txt(a?.querySelector('.button-text') ?? a), embedUrl: a?.getAttribute('data-src') ?? a?.getAttribute('href') ?? '', style: key(a, 'button') };
    }
    if (/\bvc_row\b/.test(c) && /\bvc_inner\b/.test(c)) return row(el);
    if (/\btm-social-networks\b|\bvc_empty_space\b/.test(c)) return null;
    if (c) warnings.push(c.slice(0, 80));
    return null;
  };

  function walkChildren(wrapper: Element | null): unknown[] {
    if (!wrapper) return [];
    const host = wrapper.querySelector(':scope > .wpb_wrapper') ?? wrapper;
    return [...host.children].map(block).filter(Boolean);
  }

  function row(el: Element): unknown {
    const c = el.className;
    const sep = [...el.querySelectorAll(':scope > .vc_row-separator')].map((s) => {
      const svg = s.querySelector('svg');
      return {
        position: /\btop\b/.test(s.className) ? 'top' : 'bottom',
        viewBox: svg?.getAttribute('viewBox') ?? '0 0 100 100',
        paths: [...(svg?.querySelectorAll('path, polygon') ?? [])].map((p) => p.getAttribute('d') ?? `M${p.getAttribute('points')}Z`),
        color: svg ? getComputedStyle(svg).fill : '#fff',
        height: key(svg, 'sep'),
        flip: /flip/.test(s.className) || undefined,
      };
    });
    const anchor = el.id && !/^tm-row/.test(el.id) ? el.id : undefined;
    return {
      kind: 'row',
      id: el.id || undefined,
      anchor,
      fullWidth: el.getAttribute('data-vc-full-width') === 'true',
      stretchContent: el.getAttribute('data-vc-stretch-content') === 'true',
      style: key(el, 'box'),
      overlay: key(el.querySelector(':scope > .vc_container-overlay'), 'overlay'),
      separators: sep,
      align: /vc_row-o-content-middle/.test(c) ? 'middle' : /vc_row-o-content-bottom/.test(c) ? 'bottom' : /vc_row-o-equal-height/.test(c) ? 'stretch' : undefined,
      halfBg: /section-half-bg-01/.test(c) || undefined,
      columns: [...el.querySelectorAll(':scope > .wpb_column')].map((col) => {
        const { w, o } = columnWidths(col.className);
        return { kind: 'column', width: w, offset: Object.keys(o).length ? o : undefined, style: key(col.querySelector(':scope > .vc_column-inner'), 'box'), children: walkChildren(col.querySelector(':scope > .vc_column-inner')) };
      }),
    };
  }

  // Most specific first: a selector list would return the outermost (first in document order) match.
  const content = ['#page-main-content .wpb-content-wrapper', '#page-main-content .entry-content', '#page-main-content']
    .map((sel) => document.querySelector(sel))
    .find(Boolean);
  const rows = content ? [...content.querySelectorAll(':scope > .vc_row, :scope > .vc_section > .vc_row, :scope > .vc_section')].filter((r) => r.classList.contains('vc_row')).map(row) : [];
  // Theme page-title bar (shown on pages without a WPBakery hero, e.g. Careers).
  const bar = document.querySelector('.page-title-bar');
  const titleBar =
    bar && (bar as HTMLElement).offsetHeight > 0
      ? {
          title: txt(bar.querySelector('.heading')),
          crumbs: [...bar.querySelectorAll('.insight_core_breadcrumb li')].map((li) => ({ label: txt(li), href: li.querySelector('a')?.getAttribute('href') ?? undefined })),
        }
      : undefined;
  // Some pages hide the footer's consultation band with CSS (e.g. Contact, Internship).
  const band = document.querySelector('#section-consultation') as HTMLElement | null;
  const consultation = Boolean(band && band.offsetHeight > 0);
  return { tree: { rows, titleBar, consultation, warnings }, keys: counter };
}

/** Captures computed styles for every tagged element (also runs in the browser). */
function captureStyles(): Record<string, Record<string, string>> {
  const props: Record<string, string[]> = {
    box: ['paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft', 'marginTop', 'marginBottom', 'backgroundColor', 'backgroundImage', 'backgroundSize', 'backgroundPosition', 'backgroundRepeat', 'backgroundAttachment', 'borderRadius', 'boxShadow', 'borderTop', 'borderRight', 'borderBottom', 'borderLeft', 'minHeight', 'textAlign', 'color', 'maxWidth'],
    overlay: ['backgroundColor', 'backgroundImage', 'opacity'],
    text: ['fontSize', 'fontWeight', 'lineHeight', 'color', 'letterSpacing', 'textTransform', 'textAlign', 'marginTop', 'marginBottom', 'fontStyle', 'maxWidth', 'paddingTop', 'paddingBottom', 'paddingLeft', 'paddingRight', 'backgroundColor', 'borderBottom', 'textDecorationLine'],
    button: ['fontSize', 'fontWeight', 'lineHeight', 'color', 'backgroundColor', 'backgroundImage', 'borderTop', 'borderRadius', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft', 'height', 'minWidth', 'boxShadow', 'textTransform', 'letterSpacing', 'marginTop'],
    img: ['width', 'maxWidth', 'borderRadius', 'boxShadow'],
    spacer: ['height'],
    sep: ['height'],
    grid: ['gridTemplateColumns', 'columnGap', 'rowGap'],
  };
  const out: Record<string, Record<string, string>> = {};
  document.querySelectorAll('[data-ck]').forEach((el) => {
    const s = getComputedStyle(el);
    for (const k of (el.getAttribute('data-ck') ?? '').split(' ')) {
      const role = k.split(':')[0]!;
      const list = props[role] ?? props.text!;
      const values: Record<string, string> = {};
      for (const p of list) values[p] = (s as unknown as Record<string, string>)[p] ?? '';
      // Elements the original hides (e.g. via its custom CSS) must stay hidden.
      if (s.display === 'none') values.display = 'none';
      if (role === 'text' && /^inline/.test(s.display)) values.display = s.display;
      if (role === 'grid') values.gridTemplateColumns = String(s.gridTemplateColumns.split(' ').filter(Boolean).length);
      if (role === 'img' || role === 'spacer' || role === 'sep') {
        const r = el.getBoundingClientRect();
        if (role === 'img') values.width = `${Math.round(r.width)}px`;
        if (role !== 'img') values.height = `${Math.round(r.height)}px`;
      }
      out[k] = values;
    }
  });
  return out;
}

/* ---------------------------------------------------------- Node-side helpers */

const DEFAULTS: Record<string, string[]> = {
  _: ['0px', 'none', 'normal', 'rgba(0, 0, 0, 0)', 'auto', 'start', 'repeat', 'scroll', '0% 0%', '0px none rgb(0, 0, 0)'],
};

/** Removes neutral values to keep documents small. Borders with 0 width are dropped. */
function prune(style: StyleMap): StyleMap {
  const out: StyleMap = {};
  for (const [k, v] of Object.entries(style)) {
    if (!v || DEFAULTS._!.includes(v)) continue;
    if (/^border/.test(k) && /^0px/.test(v)) continue;
    if (k === 'backgroundSize' && !style.backgroundImage?.includes('url(') && !style.backgroundImage?.includes('gradient')) continue;
    if (k === 'backgroundPosition' && !style.backgroundImage?.includes('url(')) continue;
    if (k === 'backgroundRepeat' && !style.backgroundImage?.includes('url(')) continue;
    if (k === 'opacity' && v === '1') continue;
    if (k === 'fontStyle' && v === 'normal') continue;
    if (k === 'textDecorationLine' && v === 'none') continue;
    out[k] = v;
  }
  return out;
}

/** Expresses RTL-page measurements in LTR terms; the app's RTL cache mirrors them back. */
function toLtr(style: StyleMap): StyleMap {
  const out: StyleMap = { ...style };
  const swap = (a: string, b: string) => {
    const va = style[a];
    const vb = style[b];
    delete out[a];
    delete out[b];
    if (vb !== undefined) out[a] = vb;
    if (va !== undefined) out[b] = va;
  };
  swap('paddingLeft', 'paddingRight');
  swap('borderLeft', 'borderRight');
  if (out.textAlign === 'left') out.textAlign = 'right';
  else if (out.textAlign === 'right') out.textAlign = 'left';
  if (out.backgroundPosition) out.backgroundPosition = out.backgroundPosition.replace(/\b(left|right)\b/g, (m) => (m === 'left' ? 'right' : 'left'));
  return out;
}

const diff = (a: StyleMap, base: StyleMap): StyleMap | undefined => {
  const out: StyleMap = {};
  for (const [k, v] of Object.entries(a)) if (base[k] !== v) out[k] = v;
  for (const k of Object.keys(base)) if (!(k in a)) out[k] = 'initial';
  return Object.keys(out).length ? out : undefined;
};

const assetQueue = new Map<string, string>();

/** Maps an original asset URL to its local public path and queues the download. */
function localAsset(url: string | undefined): string | undefined {
  if (!url) return url;
  const abs = url.startsWith('//') ? `https:${url}` : url.startsWith('/') ? `${ORIGIN}${url}` : url;
  const m = abs.match(/^https?:\/\/datahubanalytics\.com\/wp-content\/(uploads|themes\/mitech\/assets)\/(.+?)(\?.*)?$/);
  if (!m) return url;
  const local = `/assets/${m[1] === 'uploads' ? 'uploads' : 'theme'}/${decodeURIComponent(m[2]!)}`;
  assetQueue.set(local, abs);
  return local;
}

/** Locale-neutral internal links; external links untouched. */
function localLink(href: string | undefined): string | undefined {
  if (!href) return href;
  if (/^(mailto:|tel:|#)/.test(href)) return href;
  const asset = localAsset(href);
  if (asset !== href) return asset;
  const m = href.match(/^(?:https?:\/\/datahubanalytics\.com)?(\/[^?#]*)?(\?[^#]*)?(#.*)?$/);
  if (!m || /^https?:\/\/(?!datahubanalytics\.com)/.test(href)) return href;
  let path = m[1] ?? '/';
  if (!path.endsWith('/') && !/\.\w+$/.test(path)) path += '/';
  return `${path}${m[3] ?? ''}`;
}

/* ------------------------------------------------------------------ convert */

async function convert(page: Page, url: string, rtl: boolean) {
  await page.setViewportSize({ width: WIDTHS.xl, height: 900 });
  await page.goto(url, { waitUntil: 'networkidle', timeout: 120_000 });
  const height = await page.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0; y < height; y += 600) {
    await page.evaluate((t) => window.scrollTo(0, t), y);
    await page.waitForTimeout(60);
  }
  // Reveal everything that animates in, so measurements aren't taken mid-animation.
  await page.addStyleTag({ content: '.tm-animation,.tm-animation *{opacity:1!important;transform:none!important;animation:none!important;transition:none!important}' });
  const { tree } = await page.evaluate(walkPage);

  const styles: Record<string, Record<string, StyleMap>> = {};
  for (const [bp, width] of Object.entries(WIDTHS)) {
    await page.setViewportSize({ width, height: 900 });
    await page.waitForTimeout(700);
    styles[bp] = await page.evaluate(captureStyles);
  }

  const responsive = (k: unknown) => {
    if (typeof k !== 'string') return undefined;
    const role = k.split(':')[0];
    // Side padding WPBakery's "stretch row" JS injects per viewport ((viewport - container) / 2).
    const STRETCH_PADDING: Record<string, string[]> = { xl: ['120px'], md: ['40px'], xs: ['0px', '15px'] };
    const fix = (s: StyleMap | undefined, bp: string) => {
      if (!s) return {};
      const st = rtl ? toLtr(prune(s)) : prune(s);
      // The app's Container handles widths; drop the stretch-row artefacts.
      if (role === 'box') {
        delete st.maxWidth;
        if (st.paddingLeft === st.paddingRight && STRETCH_PADDING[bp]!.includes(st.paddingLeft ?? '')) {
          delete st.paddingLeft;
          delete st.paddingRight;
        }
        if (st.color === 'rgb(105, 105, 105)') delete st.color;
      }
      if (st.backgroundImage?.includes('url(')) {
        st.backgroundImage = st.backgroundImage.replace(/url\("?([^")]+)"?\)/g, (_, u: string) => `url(${localAsset(u)})`);
      }
      return st;
    };
    const xl = fix(styles.xl![k], 'xl');
    const md = fix(styles.md![k], 'md');
    const xs = fix(styles.xs![k], 'xs');
    return { xl, md: diff(md, xl), xs: diff(xs, md) };
  };

  // Resolve style keys, links and assets throughout the tree.
  const resolve = (node: unknown): unknown => {
    if (Array.isArray(node)) return node.map(resolve);
    if (!node || typeof node !== 'object') return node;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
      if (['style', 'height', 'overlay', 'markStyle', 'imageStyle', 'columns', 'gap', 'submitStyle'].includes(k) && typeof v === 'string') out[k] = responsive(v);
      else if (k === 'parts' && v && typeof v === 'object') out[k] = Object.fromEntries(Object.entries(v).map(([pk, pv]) => [pk, responsive(pv)]));
      else if ((k === 'href' || k === 'link' || k === 'videoUrl' || k === 'embedUrl') && typeof v === 'string') out[k] = k === 'href' || k === 'link' ? localLink(v) : v;
      else if (k === 'src' && typeof v === 'string') out[k] = localAsset(v);
      else if (k === 'svg' && typeof v === 'string') out[k] = localAsset(v);
      else if ((k === 'html' || k === 'textHtml') && typeof v === 'string') out[k] = sanitizeHtml(v, { localLink, localAsset });
      else out[k] = resolve(v);
    }
    return out;
  };

  return resolve(tree) as { rows: unknown[]; titleBar?: unknown; consultation: boolean; warnings: string[] };
}

async function downloadAssets() {
  const queue = [...assetQueue.entries()];
  let done = 0;
  const failed: string[] = [];
  await Promise.all(
    Array.from({ length: 6 }, async () => {
      for (let item = queue.shift(); item; item = queue.shift()) {
        const [local, url] = item;
        const target = join(PUBLIC, local);
        if (existsSync(target)) continue;
        const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        if (!res.ok) {
          failed.push(`${res.status} ${url}`);
          continue;
        }
        await mkdir(dirname(target), { recursive: true });
        let body = Buffer.from(await res.arrayBuffer());
        if (target.endsWith('.svg')) body = Buffer.from(sanitizeSvg(body.toString('utf8')));
        await writeFile(target, body);
        done++;
      }
    }),
  );
  console.log(`Assets: ${assetQueue.size} referenced, ${done} downloaded${failed.length ? `, ${failed.length} failed:\n  ${failed.join('\n  ')}` : ''}`);
}

/* --------------------------------------------------------------------- main */

const only = process.argv.slice(2);
const registry = (await loadRegistry()).filter((p) => !SKIP.has(p.key) && (!only.length || only.includes(p.key)));
await mkdir(OUT_DIR, { recursive: true });

const chrome: Record<string, { consultation: boolean }> = {};
const browser = await chromium.launch();
const page = await browser.newPage();
for (const entry of registry) {
  for (const locale of entry.locales) {
    const url = `${ORIGIN}${entry.path}${locale === 'ar' ? '?lang=ar' : ''}`;
    const { rows, titleBar, consultation, warnings } = await convert(page, url, locale === 'ar');
    if (locale === 'en') chrome[entry.key] = { consultation };
    const doc = { routeKey: entry.key, locale, source: url, generatedAt: new Date().toISOString().slice(0, 10), titleBar, rows };
    await writeFile(join(OUT_DIR, `${entry.key}.${locale}.json`), JSON.stringify(doc) + '\n');
    console.log(`${entry.key}.${locale}: ${rows.length} rows${warnings.length ? ` — unhandled: ${[...new Set(warnings)].join(' | ')}` : ''}`);
  }
}
await browser.close();

// Per-page layout flags read by the global footer (merged so partial runs keep other pages).
const chromeFile = join(OUT_DIR, 'chrome.json');
const previous = existsSync(chromeFile) ? (JSON.parse(await readFile(chromeFile, 'utf8')) as Record<string, { consultation: boolean }>) : {};
await writeFile(chromeFile, JSON.stringify({ ...previous, ...chrome }, null, 1) + '\n');
await downloadAssets();
