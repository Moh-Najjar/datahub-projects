import createCache, { type EmotionCache } from '@emotion/cache';
import { prefixer } from 'stylis';
import rtlPlugin from 'stylis-plugin-rtl';
import type { Direction } from '@/i18n/languages';

/**
 * One Emotion cache per direction. The RTL cache runs `stylis-plugin-rtl`, which flips physical properties
 * (left/right, margins, paddings, borders, text-align) — so styles are written once, in LTR terms, and mirror
 * automatically for Arabic. (`stylis` stays 4.2.x.)
 */
const caches: Record<Direction, EmotionCache> = {
  ltr: createCache({ key: 'mui', prepend: true }),
  rtl: createCache({ key: 'muirtl', prepend: true, stylisPlugins: [prefixer, rtlPlugin] }),
};

export const getEmotionCache = (direction: Direction): EmotionCache => caches[direction];
