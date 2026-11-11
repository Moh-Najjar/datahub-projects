import { useCallback, useEffect, useRef, useState, type FocusEvent, type KeyboardEvent } from 'react';

/**
 * Open/close state for a hover dropdown that is also keyboard accessible:
 * opens on pointer enter or focus, closes on pointer leave (with a short grace delay),
 * focus leaving the item, or Escape.
 */
export function useHoverMenu(closeDelay = 120) {
  const [open, setOpen] = useState(false);
  const timer = useRef<number | undefined>(undefined);

  const clear = () => window.clearTimeout(timer.current);
  useEffect(() => clear, []);

  const show = useCallback(() => {
    clear();
    setOpen(true);
  }, []);

  const hide = useCallback(() => {
    clear();
    timer.current = window.setTimeout(() => setOpen(false), closeDelay);
  }, [closeDelay]);

  const close = useCallback(() => {
    clear();
    setOpen(false);
  }, []);

  const itemProps = {
    onMouseEnter: show,
    onMouseLeave: hide,
    onFocus: show,
    onBlur: (e: FocusEvent<HTMLElement>) => {
      if (!e.currentTarget.contains(e.relatedTarget as Node | null)) close();
    },
    onKeyDown: (e: KeyboardEvent<HTMLElement>) => {
      if (e.key === 'Escape') {
        close();
        (e.currentTarget.querySelector('a, button') as HTMLElement | null)?.focus();
      }
    },
  };

  return { open, close, itemProps };
}
