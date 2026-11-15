import type { SxProps, Theme } from '@mui/material/styles';
import type { Responsive } from '@/modules/page-blocks/types/blocks';

type SxObject = Record<string, unknown>;

/**
 * Turns a captured `Responsive` style (xl = 1440px, md = 800px, xs = 390px) into an `sx`
 * object with MUI breakpoints: `xs` (0–767), `md` (768–1199), `xl` (1200+).
 */
export function rsx(style: Responsive | undefined): SxObject {
  if (!style) return {};
  const out: SxObject = {};
  const props = new Set([...Object.keys(style.xl), ...Object.keys(style.md ?? {}), ...Object.keys(style.xs ?? {})]);
  for (const prop of props) {
    const xl = style.xl[prop];
    const md = style.md?.[prop] ?? xl;
    const xs = style.xs?.[prop] ?? md;
    if (xs === md && md === xl) {
      if (xl !== undefined) out[prop] = xl;
      continue;
    }
    out[prop] = { xs: xs ?? 'initial', md: md ?? 'initial', xl: xl ?? 'initial' };
  }
  return out;
}

/** Merges several plain-object sx fragments (later wins). */
export const mergeSx = (...parts: Array<SxObject | SxProps<Theme> | false | undefined>): SxProps<Theme> =>
  Object.assign({}, ...parts.filter((p) => p && typeof p === 'object' && !Array.isArray(p))) as SxProps<Theme>;

/** YouTube id from a watch/share/embed URL. */
export function youtubeId(url: string): string | undefined {
  return url.match(/(?:v=|youtu\.be\/|embed\/)([\w-]{11})/)?.[1];
}
