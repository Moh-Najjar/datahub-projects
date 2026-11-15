# DataHub Website — Implementation Plan

Recreation of <https://datahubanalytics.com/> (WordPress · Mitech theme · WPBakery · WPML · Contact Form 7)
as a React 19 + TypeScript + Vite single-page application. **Recreation, not a redesign.**

_Last updated: 2026-11-10 — UI layer switched to Material UI (MUI)._

## Technology stack

| Concern | Choice |
| --- | --- |
| UI framework | **Material UI v9** (`@mui/material`), Emotion (`@emotion/react`, `@emotion/styled`) |
| Icons | `@mui/icons-material` (Font Awesome Free brand icon inlined only for LinkedIn — MUI has none) |
| RTL | Emotion cache with `stylis-plugin-rtl` + theme `direction` per locale |
| Routing | React Router v7 (data router, lazy routes) |
| Animation | Framer Motion (scroll "move-up" reveals, counters) |
| Forms | React Hook Form + Zod |
| Visual QA | Playwright (dev only) |

Not used: Tailwind, Bootstrap, CSS Modules, Lucide (replaced by MUI icons). `@mui/x-data-grid` is **not**
installed: the original site contains no data tables, so it would be an unused dependency.

## Approved decisions

1. Satoshi font, self-hosted (the original references it but never loads it).
2. Broken homepage links on the original are redirected to their real pages (`LEGACY_REDIRECTS`).
3. All blog posts exported from the public WordPress REST API into static data.
4. Playwright for screenshot-based comparison.
5. Arabic under a `/ar/...` prefix.

## Theming (single source of truth: `src/core/theme/`)

- `tokens.ts` — colors, shadows, radii, gradients measured from the original's computed styles.
- `theme.ts` — `createAppTheme(direction)`:
  - **palette**: primary `#0f56d5` (buttons, active nav), brand dark `#004493`, green `#2a9243` / `#36a829`,
    text `#696969`, headings `#333`.
  - **typography**: Satoshi; body 15px/1.74; h1–h6 48/42/32/24/18/14px, weight 400, line-height 1.42;
    Arabic uses the system sans-serif like the original.
  - **breakpoints** match the theme's Bootstrap grid: `sm 544 · md 768 · lg 992 · xl 1200`
    (desktop menu at `xl`).
  - **spacing**: 1 unit = 5px (the original's spacing scale is built on multiples of 5).
  - **component overrides**: `MuiContainer` (1200px, 15px gutters), `MuiButton` custom variants
    (`solid`, `gradient`, `textArrow`, `pill`), `MuiTab`, `MuiInputBase`/`MuiSelect` (CF7 field look),
    `MuiPaper`, `MuiDrawer`, `MuiCssBaseline` (fonts, `<mark>`, link defaults).
- `AppThemeProvider` — Emotion `CacheProvider` (LTR or RTL cache) + `ThemeProvider` + `CssBaseline`.

## Component mapping

| Original element | MUI implementation |
| --- | --- |
| Header bar / sticky header | `Box` + `Container`, `useScrollTrigger` for the sticky state |
| Dropdowns, mega menu | `Paper` + `Grid` panels (hover + keyboard), `Collapse`-free CSS transition |
| Mobile off-canvas menu | `Drawer` (anchor flips in RTL) + `List` + `Collapse` |
| Solutions & Services tabs | `Tabs` / `Tab` with custom styling |
| Intro video popup | `Dialog` |
| Cards (hero, blog, DWaaS/DAaaS) | `Card` / `Paper` |
| Layout grids | `Grid`, `Stack`, `Box` |
| Appointment form | `TextField` / `Select` (+ RHF `Controller`, Zod schema) |
| Count-up stats | `Typography` + `useCountUp` hook |
| Footer particles | small canvas component (port of the theme's particles.js config) |

## Architecture

`core` / `i18n` / `modules`, following the ASEZA project's layout (restructured 2026-11-11). The full tree, the
"where is…?" table, rules, import conventions and examples are maintained in [../CLAUDE.md](../CLAUDE.md#structure);
in short:

```
src/
  App.tsx, main.tsx
  core/         routes (router + paths/ROUTES), config (page SEO registry, navigation), theme, hooks, types
  i18n/         locales/en.json + ar.json (UI strings), LocaleProvider/useLocale, languages, path helpers
  modules/      shared (reusable components), layout (header/footer/menus), home, blog, contact (incl. api/),
                page-blocks (renders every generated page), products (DataHub's own catalogue page,
                api → mock data), errors (404, route error)
  content/      generated page documents and blog data (never hand-edited)
scripts/        download-assets, export-blog, convert-pages, screenshot/compare (Playwright)
public/         assets/ (logos, clients, technologies, backgrounds, blog, docs), fonts/
```

Rules: business content lives in typed data files (`core/config/`, `modules/*/data/`), the UI translations
(`i18n/locales/`) and the generated `content/`, never inside components; components take typed props;
styles live in the theme or in `sx`/`styled` next to the component; physical `left/right` in Emotion styles
(they are flipped automatically by the RTL cache).

## Inner pages: block documents

41 pages × 2 languages share one vocabulary of ~25 theme widgets (`tm-heading`, `tm-box-icon`, `tm-box-image`,
`tm-list`, `tm-accordion`, tabs, counters, galleries…). Instead of hand-writing 68 page components (error-prone and
impossible to keep faithful), `scripts/convert-pages.ts` converts each live page into a typed JSON document with the
real content, assets and computed styles at three widths; `BlockPage` renders it with one MUI component per widget.
The homepage remains hand-built.

## Phases

| # | Phase | Status |
| --- | --- | --- |
| 1 | Research & planning | ✅ done |
| 2 | Foundation: deps, theme, RTL, router, layout shell (header/footer), assets, CLAUDE.md | ✅ done |
| 3 | Homepage sections A→O | ✅ done |
| 4 | Inner pages (block documents) + blog export | ✅ done |
| 5 | Interactions (menus, video/map dialogs, counters, carousels, language switching) | ✅ done |
| 6 | Testing (types, lint, build, links, forms, overflow at 7 widths) | ✅ done |
| 7 | Visual comparison vs. original (`npm run compare`) and fixes | ✅ done — see results below |

## Known limitations

- Desktop dropdown hover can't be triggered on the original in headless mode; menus were measured by forcing them visible.
- Industry/contact icons on the original are Font Awesome 5 **Pro Light** (licensed) → closest `@mui/icons-material` outlined equivalents.
- No form backend: the form validates and clearly reports that nothing was sent unless `VITE_FORM_ENDPOINT` is set.
- `case_study` entries on the original are theme demo content and are intentionally not recreated.
