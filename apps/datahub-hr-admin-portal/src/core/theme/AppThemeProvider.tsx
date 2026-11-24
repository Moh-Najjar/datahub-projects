import { useMemo, type ReactNode } from 'react';
import { CacheProvider } from '@emotion/react';
import CssBaseline from '@mui/material/CssBaseline';
import { ThemeProvider } from '@mui/material/styles';
import { useLanguage } from '@/i18n/useLanguage';
import { getEmotionCache } from './emotionCache';
import { createAppTheme } from './theme';

/**
 * Theme + RTL/LTR styling for the active language. The portal is light only (like every DataHub admin app).
 * Re-renders when the language changes.
 */
export function AppThemeProvider({ children }: { children: ReactNode }) {
  const { direction } = useLanguage();
  const theme = useMemo(() => createAppTheme(direction), [direction]);

  return (
    <CacheProvider value={getEmotionCache(direction)}>
      <ThemeProvider theme={theme} defaultMode="light" disableTransitionOnChange>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </CacheProvider>
  );
}
