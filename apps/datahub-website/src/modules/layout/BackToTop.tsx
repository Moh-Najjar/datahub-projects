import { useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import NorthIcon from '@mui/icons-material/North';
import { UI } from '@/i18n';
import { useLocalized } from '@/i18n/LocaleContext';

/** Shown once the page is scrolled further than this (the original's threshold). */
const SHOW_AFTER_PX = 200;

/**
 * The original's floating "back to top" button (theme's `#page-scroll-up`): a 60px blue circle in the bottom corner that
 * slides in after scrolling, with an arrow that slides up on hover. Scrolls smoothly unless the user prefers reduced
 * motion. Mirrors to the left in Arabic (RTL), like the rest of the layout.
 */
export function BackToTop() {
  const ui = useLocalized(UI);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const update = () => setVisible(window.scrollY > SHOW_AFTER_PX);
    update();
    window.addEventListener('scroll', update, { passive: true });
    return () => window.removeEventListener('scroll', update);
  }, []);

  const toTop = () => {
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
  };

  const arrow = {
    position: 'absolute',
    top: '50%',
    left: '50%',
    fontSize: 26,
    transition: 'transform .3s cubic-bezier(0.645, 0.045, 0.355, 1)',
  } as const;

  return (
    <Box
      component="button"
      type="button"
      onClick={toTop}
      aria-label={ui.backToTop}
      tabIndex={visible ? 0 : -1}
      aria-hidden={!visible}
      sx={{
        position: 'fixed',
        right: 30,
        bottom: visible ? 30 : -60,
        zIndex: 999,
        width: 60,
        height: 60,
        p: 0,
        border: 0,
        borderRadius: '50%',
        overflow: 'hidden',
        cursor: 'pointer',
        color: 'common.white',
        bgcolor: 'brand.dark',
        boxShadow: '0 2px 2px 0 rgba(0,0,0,.14), 0 1px 5px 0 rgba(0,0,0,.12), 0 3px 1px -2px rgba(0,0,0,.2)',
        opacity: visible ? 1 : 0,
        visibility: visible ? 'visible' : 'hidden',
        transition: 'all .3s cubic-bezier(0.645, 0.045, 0.355, 1)',
        '& .arrow-top': { transform: 'translate(-50%, -50%)' },
        '& .arrow-bottom': { transform: 'translate(-50%, 80px)' },
        '&:hover .arrow-top, &:focus-visible .arrow-top': {
          transform: 'translate(-50%, -80px)',
        },
        '&:hover .arrow-bottom, &:focus-visible .arrow-bottom': {
          transform: 'translate(-50%, -50%)',
        },
        '@media print': { display: 'none' },
      }}
    >
      <NorthIcon className="arrow-top" aria-hidden sx={arrow} />
      <NorthIcon className="arrow-bottom" aria-hidden sx={arrow} />
    </Box>
  );
}
