# CLAUDE.md — DataHub Website

Faithful recreation of <https://datahubanalytics.com/> (a WordPress/Mitech site) in React 19 + TypeScript + Vite + **Material UI**.
This is a **recreation, not a redesign**: the live site is the source of truth for content, layout, spacing and behaviour.
Full plan and decisions: [docs/PLAN.md](docs/PLAN.md).

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Vite dev server (port 5173) |
| `npm run build` | Type-check (`tsc -b`) + production build |
| `npm run typecheck` / `npm run lint` | TypeScript (strict) / oxlint |
| `npm run assets` | Download original public assets listed in `scripts/assets.manifest.ts` into `public/` (idempotent) |
| `npm run blog:export` | Export blog posts from the original's WordPress REST API into `src/content/blog/` |
| `npm run pages:convert -- [routeKey…]` | Re-generate inner-page documents from the live site (see "Content pipeline") |
| `npm run screenshot -- <url> <outDir> [width]` | Playwright viewport-chunk screenshots for visual comparison |

Run `npm run typecheck && npm run lint && npm run build` before considering any change done.

## Non-negotiable rules

1. **No invented content.** Every string, number, image and link must come from the original site. Keep the original's
   wording verbatim (including its typos, e.g. "Big Data Analyics"). If something can't be obtained, say so — don't guess.
2. **No fake assets.** Never draw, generate or substitute logos/images. Add new originals to `scripts/assets.manifest.ts`
   and run `npm run assets`. Licensed icon fonts (Font Awesome Pro) are replaced by the closest `@mui/icons-material` icon.
3. **Measure, don't eyeball.** Take sizes/colors from the original's computed styles (Playwright) and put shared values in
   `src/shared/theme/tokens.ts`.
4. **Content is data.** Copy lives in typed data modules (`src/shared/config/`, `src/features/*/data/`) and the generated
   `src/content/`, as typed `Localized<T>` records — never hard-coded in components. Components receive typed props.
5. **Forms never fake success.** Without `VITE_FORM_ENDPOINT` the form must say the message was not sent.

## Styling (MUI)

- Theme: `src/shared/theme/theme.ts` (`createAppTheme(direction)`), tokens in `src/shared/theme/tokens.ts`, type
  augmentation in `src/shared/theme/augmentation.d.ts`. Custom palette lives under `palette.brand.*`; shadows under `theme.customShadows`.
- Spacing unit is **5px** (`sx={{ p: 6 }}` = 30px). Pixel strings (`'30px'`) are fine when copying measured values.
- Breakpoints mirror the original grid: `sm 544 · md 768 · lg 992 · xl 1200`. The desktop menu shows from `xl`.
- Button variants: `solid`, `gradient`, `textArrow`, `pill` (use `ButtonLink` for links).
- Style with the theme, `sx`, or `styled()` next to the component. No CSS Modules, Tailwind or Bootstrap. Avoid inline `style`.
- **RTL:** Arabic uses an Emotion cache with `stylis-plugin-rtl`. Write styles with **physical** `left/right`
  (they're flipped automatically). Don't use logical `inset-inline-*`/`margin-inline-*` in Emotion styles — they'd be
  correct already and must not be double-handled. `translateX` and icons are **not** flipped: handle them with
  `theme.direction`. Write gradients with angles (`90deg`), never `to right` — the plugin flips direction
  keywords, but the original's Arabic pages keep gradients left-to-right.
- `stylis` is pinned to 4.2.0 to match Emotion; a mismatched version crashes the RTL plugin.

## Routing & i18n

- Canonical URLs (identical to the original, trailing slash) are in `src/shared/config/routes.ts` (`ROUTES`). Never hard-code paths.
- Arabic = same path under `/ar`. `src/shared/config/pages.ts` records which locales each page exists in (from the original) and its
  original SEO title/description. Arabic URLs of English-only pages redirect to the English page.
- Use `SmartLink`/`ButtonLink` for links: they add the locale prefix and handle external/`tel:`/`mailto:`/file links.
- Each page renders `<PageSeo routeKey="…" />` (React 19 hoists `<title>`/`<meta>`).
- Broken links on the original are redirected via `LEGACY_REDIRECTS`.

## Structure

Feature-based. Layers, lowest first — each may import only from layers to its left:
**`i18n` ← `shared` ← `features` ← `pages` ← `app`**. Enforced by `no-restricted-imports` overrides in `.oxlintrc.json`.

```
src/
├── main.tsx
├── app/                 composition root — nothing imports it (except main.tsx)
│   ├── App.tsx
│   ├── router/          router (lazy routes, LEGACY_REDIRECTS, /ar tree), RouteError (errorElement)
│   └── layout/          site shell: SiteLayout, Header/, Footer/, Navigation/ (desktop/mobile menus,
│                        language switcher, nav-only hooks)
├── pages/               route components: Home, BlockPage (all generated pages), Blog post, 404
├── features/            one folder per feature with real code; each exposes its public API in index.ts
│   ├── home/            homepage sections + home copy (data/homeContent.ts), logos, industry icons
│   ├── blog/            BlogCard, BlogGrid, lazy blog loader, blog types, date helpers
│   ├── contact/         AppointmentForm (+ Zod schema, submit service), consultation band, contact details
│   └── page-blocks/     renderer for generated page documents (NodeRenderer, PageTitleBar, widgets/)
├── shared/              generic, feature-free building blocks
│   ├── components/ui/   SmartLink, ButtonLink, Rich, Reveal, AutoCarousel, VideoPoster, LinkedInIcon
│   ├── components/seo/  Seo, PageSeo
│   ├── config/          site registries: routes (ROUTES), pages (locales + SEO), navigation
│   ├── hooks/           useCountUp, useRouteKey (+ PageHandle)
│   ├── theme/           MUI theme, tokens, RTL Emotion cache, AppThemeProvider
│   └── types/           RichText, ImageAsset, navigation types
├── i18n/                locale context/provider, path helpers, UI strings, useAlternateHref
└── content/             GENERATED only (pages/*.json, chrome.json, blog/**) — never hand-edit
```

Inside a feature: `components/`, `data/`, `types/`, `utils/`, `services/`, `schemas/` — create a folder only when it
has content. Images and fonts stay in `public/` (generated content references them by URL).

### Where code goes

- **Used by one feature** → inside that feature. Used by **two or more** features/pages and free of business data →
  `shared/`. Don't move something to `shared/` "in case".
- **`shared/` never imports `features/`, `pages/` or `app/`** and holds no business logic (static registries in
  `shared/config/` are data, not logic).
- **Features don't import each other.** Allowed composition edges (embedding another feature's widget):
  `home → blog`, `page-blocks → blog, contact`. Anything new needs a real reason and an update to `.oxlintrc.json`.
- **Pages** compose features and shared components; keep business logic in features.
- **Site shell** (header, footer, menus) lives in `app/layout/` because it composes features and site navigation data.
- **A new page** of the original site: add its route to `shared/config/routes.ts` + `pages.ts`, then generate its
  document (`npm run pages:convert -- <routeKey>`); `BlockPage` renders it — no new feature needed. Create a feature
  only for a page with hand-built code (like `home`).
- **A new feature**: `src/features/<name>/` + `index.ts` exporting only what other layers use, and an oxlint override
  copied from an existing feature.

### Import conventions

- Use the `@/` alias for anything outside the current folder; relative imports (`./x`) only within a folder.
- Outside a feature, import it **only through its public API**: `@/features/blog`, never `@/features/blog/components/…`.
  Inside a feature, import its own modules directly.
- Barrels exist only at feature roots. They're marked side-effect free in `vite.config.ts`, so importing one never
  pulls a feature's other modules into a page's chunk — keep them pure re-exports.

## Content pipeline (inner pages)

- The homepage is hand-built (`src/features/home`, copy in `src/features/home/data/homeContent.ts`).
- Every other page is a **page document** (`src/content/pages/<routeKey>.<locale>.json`, typed in
  `src/features/page-blocks/types/blocks.ts`) generated by `scripts/convert-pages.ts`: it walks the original WPBakery DOM in Chromium
  (rows → columns → widgets), captures each element's computed styles at 1440/800/390px, sanitizes HTML, rewrites
  links to locale-neutral paths and downloads assets to `public/assets/uploads/` (original paths kept).
- `src/pages/BlockPage` renders documents with `src/features/page-blocks` (one MUI component per theme widget).
  Fix rendering issues in the widget components or the converter — **never hand-edit the JSON**, regenerate it.
- Arabic documents are captured from the RTL pages and converted to LTR terms (`toLtr`), then mirrored by the
  RTL cache.
- `src/content/pages/chrome.json` (also generated) records per-page layout flags, e.g. whether the original shows
  the footer's consultation band on that page (hidden on Contact and Internship).
- Pages without a WPBakery hero use the theme's page-title bar (`titleBar` in the document → `PageTitleBar`).
- Blog: `npm run blog:export` → `src/content/blog/` (index, latest 3, one JSON per post) + `public/assets/posts/`
  (WebP resized to display size with `sharp`: 370×207 card, 370×230 grid, ≤1170px article image).

## Visual comparison workflow

`npm run screenshot -- https://datahubanalytics.com/<path> <dir>/orig 1440` and the same for `http://localhost:5173/<path>`,
then compare chunk by chunk. Check 1920/1440/1280/1024/768/390/375 and both `/` and `/ar/`.
