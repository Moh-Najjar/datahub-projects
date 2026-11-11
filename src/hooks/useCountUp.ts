import { useEffect, useState } from 'react';
import { useReducedMotion } from 'framer-motion';

/**
 * Animates an integer from 0 to `target` once `start` becomes true
 * (the original uses jQuery countTo on its statistics counters).
 * With reduced motion the final value is shown immediately.
 */
export function useCountUp(target: number, start: boolean, duration = 2000): number {
  const reduceMotion = useReducedMotion();
  const [value, setValue] = useState(0);
  const animate = start && !reduceMotion;

  useEffect(() => {
    if (!animate) return;
    let frame = 0;
    const startedAt = performance.now();
    const tick = (now: number) => {
      const progress = Math.min((now - startedAt) / duration, 1);
      setValue(Math.round(target * (1 - Math.pow(1 - progress, 3))));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [animate, target, duration]);

  if (reduceMotion) return start ? target : 0;
  return value;
}
