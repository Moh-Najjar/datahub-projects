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

## Theming (single source of truth: `src/theme/`)

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

```
src/
  app/          App, router, route registry (ROUTES, redirects), page registry
  theme/        tokens, createAppTheme, RTL caches, AppThemeProvider, type augmentation
  i18n/         locale types, LocaleProvider/useLocale, path helpers, UI dictionary
  data/         navigation, contact, services, industries, statistics, clients, technologies
  content/      page copy per locale (typed `Localized<T>`), generated blog data
  components/
    common/     SmartLink, Rich (mark highlights), Reveal, Seo, SectionHeading, ButtonLink …
    layout/     Header, DesktopNav, MegaMenu, MobileMenu, Footer, Consultation, AppointmentForm
  sections/     homepage + shared page sections (Hero, Stats, Clients, Technologies …)
  pages/        route components (Home, About, Contact, Blog, BlogPost, Industries, Service …)
  hooks/        useScrolled, useCountUp, useHoverMenu, useIsActive, useAlternateHref …
  types/        shared TypeScript types
scripts/        download-assets, export-blog, screenshot (Playwright)
public/         assets/ (logos, clients, technologies, backgrounds, blog, docs), fonts/
```

Rules: business content lives in `data/` + `content/`, never inside components; components take typed props;
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
