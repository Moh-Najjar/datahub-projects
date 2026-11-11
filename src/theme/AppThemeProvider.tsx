import { useMemo, type ReactNode } from 'react';
import { CacheProvider } from '@emotion/react';
import CssBaseline from '@mui/material/CssBaseline';
import { ThemeProvider } from '@mui/material/styles';
import { useLocale } from '@/i18n/LocaleContext';
import { getEmotionCache } from './emotionCache';
import { createAppTheme } from './theme';

/**
 * Applies the MUI theme for the active locale: LTR for English, RTL (flipped Emotion
 * cache + `theme.direction`) for Arabic. Must be rendered inside `<LocaleProvider>`.
 */
export function AppThemeProvider({ children }: { children: ReactNode }) {
  const { dir } = useLocale();
  const theme = useMemo(() => createAppTheme(dir), [dir]);

  return (
    <CacheProvider value={getEmotionCache(dir)}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </CacheProvider>
  );
}
