import { useMemo } from 'react';
import { useColorScheme } from '@mui/material/styles';
import { useLanguage } from '@/i18n/useLanguage';
import type { ChartContext } from './base';

/** Colour scheme + language/direction for chart options; charts rebuild their option when these change. */
export function useChartContext(): ChartContext {
  const { mode, systemMode } = useColorScheme();
  const { language, direction } = useLanguage();
  const resolved = (mode === 'system' ? systemMode : mode) === 'dark' ? 'dark' : 'light';
  return useMemo(() => ({ mode: resolved, direction, language }), [resolved, direction, language]);
}
