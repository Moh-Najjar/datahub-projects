/**
 * Visible to screen readers only. Sizes are pixel STRINGS: in MUI `sx` a number ≤ 1 is a fraction
 * (`width: 1` = 100%), which would make the hidden element full-width and overflow the page.
 */
export const visuallyHidden = {
  position: 'absolute',
  width: '1px',
  height: '1px',
  margin: '-1px',
  padding: 0,
  overflow: 'hidden',
  clip: 'rect(0 0 0 0)',
  whiteSpace: 'nowrap',
  border: 0,
} as const;
