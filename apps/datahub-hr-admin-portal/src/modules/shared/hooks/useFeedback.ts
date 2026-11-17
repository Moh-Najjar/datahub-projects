import { useCallback, useState } from 'react';

export interface FeedbackMessage {
  text: string;
  severity: 'success' | 'error';
}

/** Local "toast" state for a section: `notify(...)` then render `<Feedback {...feedback} />`. */
export function useFeedback() {
  const [message, setMessage] = useState<FeedbackMessage | null>(null);
  const notify = useCallback((text: string, severity: FeedbackMessage['severity'] = 'success') => setMessage({ text, severity }), []);
  const close = useCallback(() => setMessage(null), []);
  return { message, notify, close };
}
