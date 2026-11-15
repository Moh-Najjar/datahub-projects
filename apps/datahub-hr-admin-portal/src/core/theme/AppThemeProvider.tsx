import { useMemo, type ReactNode } from 'react';
import { CacheProvider } from '@emotion/react';
import CssBaseline from '@mui/material/CssBaseline';
import { ThemeProvider } from '@mui/material/styles';
import { useLanguage } from '@/i18n/useLanguage';
import { getEmotionCache } from './emotionCache';
import { createAppTheme } from './theme';

/** Where the light/dark choice is remembered (MUI reads and writes it). Light is the default. */
export const COLOR_MODE_STORAGE_KEY = 'datahub-hr-admin.color-mode';

/**
 * Theme + RTL/LTR styling for the active language, and the light/dark colour scheme
 * (switch it with MUI's `useColorScheme()`). Re-renders when the language changes.
 */
export function AppThemeProvider({ children }: { children: ReactNode }) {
  const { direction } = useLanguage();
  const theme = useMemo(() => createAppTheme(direction), [direction]);

  return (
    <CacheProvider value={getEmotionCache(direction)}>
      <ThemeProvider theme={theme} defaultMode="light" modeStorageKey={COLOR_MODE_STORAGE_KEY} disableTransitionOnChange>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </CacheProvider>
  );
}
