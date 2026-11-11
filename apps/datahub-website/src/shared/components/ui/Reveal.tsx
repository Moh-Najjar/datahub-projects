import type { ReactNode } from 'react';
import { motion, type HTMLMotionProps } from 'framer-motion';

type RevealTag = 'div' | 'section' | 'li' | 'article' | 'header';

interface RevealProps extends Omit<HTMLMotionProps<'div'>, 'children'> {
  children: ReactNode;
  as?: RevealTag;
  /** Delay in seconds (used for staggered grids). */
  delay?: number;
}

/**
 * The original theme's "move-up" entrance animation:
 * elements start 100px lower and transparent, then rise in over 0.4s when scrolled into view.
 */
export function Reveal({ children, as = 'div', delay = 0, ...rest }: RevealProps) {
  const Component = motion[as] as typeof motion.div;
  return (
    <Component
      initial={{ opacity: 0, y: 100 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '0px 0px -40px 0px' }}
      transition={{ duration: 0.4, ease: 'easeOut', delay }}
      {...rest}
    >
      {children}
    </Component>
  );
}
