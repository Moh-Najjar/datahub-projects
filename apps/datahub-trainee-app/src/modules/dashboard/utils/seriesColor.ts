import { chart } from '@/core/theme/tokens';

/** Colour of the n-th training row: its progress bar and its table dot share it. */
export const seriesColor = (index: number): string => chart[index % chart.length]!;
