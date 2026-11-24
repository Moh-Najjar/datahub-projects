/**
 * jsdom has no `matchMedia`. This stand-in evaluates `min-width` / `max-width` queries against a configurable
 * viewport width (MUI breakpoints) and reports no colour-scheme preference (light).
 */
let viewportWidth = 1280;

export function setViewportWidth(width: number): void {
  viewportWidth = width;
}

function matches(query: string): boolean {
  const min = /min-width:\s*([\d.]+)px/.exec(query);
  const max = /max-width:\s*([\d.]+)px/.exec(query);
  if (min && viewportWidth < Number(min[1])) return false;
  if (max && viewportWidth > Number(max[1])) return false;
  return !!(min || max);
}

window.matchMedia = (query: string): MediaQueryList => ({
  matches: matches(query),
  media: query,
  onchange: null,
  addListener: () => {},
  removeListener: () => {},
  addEventListener: () => {},
  removeEventListener: () => {},
  dispatchEvent: () => false,
});
