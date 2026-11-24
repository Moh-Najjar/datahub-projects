import { createContext, use } from 'react';

type Severity = 'success' | 'error' | 'info';

export interface FeedbackApi {
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
}

export type { Severity };

export const FeedbackContext = createContext<FeedbackApi | null>(null);

export function useFeedback(): FeedbackApi {
  const ctx = use(FeedbackContext);
  if (!ctx) throw new Error('useFeedback must be used inside <FeedbackProvider>.');
  return ctx;
}
