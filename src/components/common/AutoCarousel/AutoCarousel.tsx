import { useEffect, useState, type ReactNode } from 'react';
import Box from '@mui/material/Box';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';
import { useReducedMotion } from 'framer-motion';

interface AutoCarouselProps<T> {
  items: readonly T[];
  renderItem: (item: T, index: number) => ReactNode;
  getKey: (item: T, index: number) => string;
  /** Items visible per breakpoint (mirrors Swiper's data-xs/sm/md/lg-items). */
  perView: { xs: number; sm: number; md: number; lg: number };
  gap?: number;
  /** Pause between slides in ms (Swiper `autoplay.delay`). */
  delay?: number;
  /** Slide transition in ms (Swiper `speed`). */
  speed?: number;
  /** `center` for logos (Swiper "v-center"), `stretch` for equal-height cards. */
  align?: 'center' | 'stretch';
  label: string;
}

/**
 * Small looping carousel that advances one item at a time (the original's Swiper client
 * carousel). Items are duplicated so the loop is seamless; it pauses on hover/focus and
 * when the user prefers reduced motion.
 */
export function AutoCarousel<T>({
  items,
  renderItem,
  getKey,
  perView,
  gap = 30,
  delay = 1000,
  speed = 800,
  align = 'center',
  label,
}: AutoCarouselProps<T>) {
  const theme = useTheme();
  const reduceMotion = useReducedMotion();
  const lg = useMediaQuery(theme.breakpoints.up('lg'));
  const md = useMediaQuery(theme.breakpoints.up('md'));
  const sm = useMediaQuery(theme.breakpoints.up('sm'));
  const visible = lg ? perView.lg : md ? perView.md : sm ? perView.sm : perView.xs;

  const [index, setIndex] = useState(0);
  const [animate, setAnimate] = useState(true);
  const [paused, setPaused] = useState(false);
  const count = items.length;

  useEffect(() => {
    if (paused || reduceMotion || count <= visible) return;
    const timer = window.setTimeout(() => {
      setAnimate(true);
      setIndex((i) => i + 1);
    }, delay + speed);
    return () => window.clearTimeout(timer);
  }, [index, paused, reduceMotion, count, visible, delay, speed]);

  // After sliding onto the duplicated first item, jump back without animation.
  const onTransitionEnd = () => {
    if (index >= count) {
      setAnimate(false);
      setIndex(0);
    }
  };

  const loop = count > visible ? [...items, ...items.slice(0, visible)] : [...items];
  const step = `(100% + ${gap}px) / ${visible}`;
  const sign = theme.direction === 'rtl' ? 1 : -1;

  return (
    <Box
      role="region"
      aria-roledescription="carousel"
      aria-label={label}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      // Vertical bleed so hover lifts and shadows of slides aren't clipped.
      sx={{ overflow: 'hidden', py: '10px', my: '-10px' }}
    >
      <Box
        onTransitionEnd={onTransitionEnd}
        sx={{
          display: 'flex',
          alignItems: align,
          gap: `${gap}px`,
          transform: `translateX(calc(${sign} * ${index} * ${step}))`,
          transition: animate ? `transform ${speed}ms ease` : 'none',
        }}
      >
        {loop.map((item, i) => (
          <Box
            key={`${getKey(item, i % count)}-${i}`}
            aria-hidden={i >= count || undefined}
            sx={{ flex: `0 0 calc((100% - ${(visible - 1) * gap}px) / ${visible})`, minWidth: 0 }}
          >
            {renderItem(item, i % count)}
          </Box>
        ))}
      </Box>
    </Box>
  );
}
