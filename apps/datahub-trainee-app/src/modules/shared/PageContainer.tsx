import type { ReactNode } from 'react';
import Box from '@mui/material/Box';
import { motion, useReducedMotion } from 'framer-motion';
import { layout } from '@/core/theme/tokens';

/** Page width + a subtle entrance (skipped when the user prefers reduced motion). */
export function PageContainer({ children }: { children: ReactNode }) {
  const reduce = useReducedMotion();
  return (
    <Box
      component={motion.div}
      initial={reduce ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: 'easeOut' }}
      sx={{ width: '100%', maxWidth: layout.contentMax, mx: 'auto' }}
    >
      {children}
    </Box>
  );
}
