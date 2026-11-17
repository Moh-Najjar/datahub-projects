# CLAUDE.md — DataHub Website

Faithful recreation of <https://datahubanalytics.com/> (a WordPress/Mitech site) in React 19 + TypeScript + Vite + **Material UI**.
This is a **recreation, not a redesign**: the live site is the source of truth for content, layout, spacing and behaviour.
DataHub is also adding **its own pages** that the original site doesn't have (starting with **Products**, `/products/`),
built in the same visual identity. Full plan and decisions: [docs/PLAN.md](docs/PLAN.md).

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

1. **No invented content.** Every string, number, image and link on a **recreated** page must come from the original site.
   Keep the original's wording verbatim (including its typos, e.g. "Big Data Analyics"). If something can't be obtained,
   say so — don't guess. **Exception — DataHub's own pages** (currently only Products): their copy is written by
   DataHub, not copied. It must never claim that an unfinished product is available or has features that don't exist,
   and placeholder copy must be marked as such in its data file. Recreated pages keep following the original-content rule.
2. **No fake assets.** Never draw, generate or substitute logos/images. Add new originals to `scripts/assets.manifest.ts`
   and run `npm run assets`. Licensed icon fonts (Font Awesome Pro) are replaced by the closest `@mui/icons-material` icon.
3. **Measure, don't eyeball.** Take sizes/colors from the original's computed styles (Playwright) and put shared values in
   `src/core/theme/tokens.ts`.
4. **Content is data.** Copy lives in typed data files (`src/core/config/`, `src/modules/*/data/`), the UI translations
   (`src/i18n/locales/`) and the generated `src/content/` — never hard-coded in components. Components receive typed props.
5. **Forms never fake success.** Without `VITE_FORM_ENDPOINT` the form must say the message was not sent.

## Styling (MUI)

- Theme: `src/core/theme/theme.ts` (`createAppTheme(direction)`), tokens in `src/core/theme/tokens.ts`, type
  augmentation in `src/core/theme/augmentation.d.ts`. Custom palette lives under `palette.brand.*`; shadows under `theme.customShadows`.
- Spacing unit is **5px** (`sx={{ p: 6 }}` = 30px). Pixel strings (`'30px'`) are fine when copying measured values.
- Breakpoints mirror the original grid: `sm 544 · md 768 · lg 992 · xl 1200`. The desktop menu shows from `xl`.
  With the added Products and HR Portal items, top-level menu items use tighter spacing from 1200px until the
  menu fits with the original spacing (`ROOMY_FROM` in `Navigation/DesktopNav.styles.ts`: 1540px EN, 1800px AR),
  and the HR Portal item is an icon (label as tooltip/accessible name) below 1440px. Re-check the fit (EN and AR,
  1200–1920px) whenever a top-level menu item is added.
- Button variants: `solid`, `gradient`, `textArrow`, `pill` (use `ButtonLink` for links).
- Style with the theme, `sx`, or `styled()` next to the component. No CSS Modules, Tailwind or Bootstrap. Avoid inline `style`.
- **RTL:** Arabic uses an Emotion cache with `stylis-plugin-rtl`. Write styles with **physical** `left/right`
  (they're flipped automatically). Don't use logical `inset-inline-*`/`margin-inline-*` in Emotion styles — they'd be
  correct already and must not be double-handled. `translateX` and icons are **not** flipped: handle them with
  `theme.direction`. Write gradients with angles (`90deg`), never `to right` — the plugin flips direction
  keywords, but the original's Arabic pages keep gradients left-to-right.
- `stylis` is pinned to 4.2.0 to match Emotion; a mismatched version crashes the RTL plugin.

## Routing & i18n

- Canonical URLs (identical to the original, trailing slash) are in `src/core/routes/paths.ts` (`ROUTES`). Never hard-code paths.
- Arabic = same path under `/ar`. `src/core/config/pages.ts` records which locales each page exists in (from the original) and its
  original SEO title/description. Arabic URLs of English-only pages redirect to the English page.
- Interface strings (header, footer, form, buttons) are in `src/i18n/locales/en.json` and `ar.json`, typed by `UiStrings`
  in `src/i18n/index.ts` — both files must have every key (`tsc` fails otherwise). Use them with `useLocalized(UI)`.
  There is no i18next: the locale comes from the URL (`LocaleProvider`), and RTL is handled by the theme's Emotion cache.
- Use `SmartLink`/`ButtonLink` for links: they add the locale prefix and handle external/`tel:`/`mailto:`/file links.
- Each page renders `<PageSeo routeKey="…" />` (React 19 hoists `<title>`/`<meta>`).
- Broken links on the original are redirected via `LEGACY_REDIRECTS`.

## Structure

Three top-level areas (same layout as the ASEZA project): **`core`** = application infrastructure, **`i18n`** =
translations and localization, **`modules`** = all website functionality.

```
src/
├── main.tsx                 mounts <App />
├── App.tsx                  <RouterProvider router={router} />
├── core/                    application infrastructure — never imports modules (except the router)
│   ├── routes/
│   │   ├── index.tsx        the router: lazy-loads each module's page, /ar tree, legacy redirects, 404
│   │   └── paths.ts         ROUTES (every URL), LEGACY_REDIRECTS, EXTERNAL_LINKS
│   ├── config/              pages.ts (locales + SEO per route), navigation.ts (menus, footer columns)
│   ├── theme/               MUI theme, tokens, RTL Emotion cache, AppThemeProvider
│   ├── hooks/               useCountUp, useRouteKey
│   └── types/               RichText, ImageAsset, navigation types
├── i18n/                    translations and localization
│   ├── locales/en.json      interface strings (English)
│   ├── locales/ar.json      interface strings (Arabic)
│   ├── index.ts             UI (typed by UiStrings)
│   ├── languages.ts         Locale/Direction (from @datahub/shared-types), LOCALES, LOCALE_DIRECTION
│   └── LocaleContext.ts, LocaleProvider.tsx, paths.ts (localizePath…), useAlternateHref.ts
├── modules/                 all website functionality
│   ├── shared/              reusable components: SmartLink, ButtonLink, Rich, Reveal, AutoCarousel,
│   │                        VideoPoster, LinkedInIcon, Seo, PageSeo, PageTitleBar
│   ├── layout/              site shell: SiteLayout, Header/, Footer/, Navigation/ (menus, language switcher)
│   ├── home/                HomePage.tsx, components/ (sections), data/ (home copy, logos, industry icons)
│   ├── blog/                BlogPostPage.tsx, ArabicPostRedirect.tsx, components/, api/blogApi.ts (blog service),
│   │                        data/ (seed, blogStore, cached readers), hooks/, types/, utils/ (sanitizeHtml, articleStyles)
│   ├── admin/               /admin/ area (blog management prototype): AdminLayout + pages, api/authService.ts,
│   │                        components/ (BlogForm, RichTextEditor, CoverField), schemas/, hooks/, data/, utils/
│   ├── contact/             api/appointment.ts, components/ (AppointmentForm, ConsultationSection), schemas/, data/
│   ├── page-blocks/         BlockPage.tsx — renders every generated page (about-us, services, solutions, contact,
│   │                        careers, blog list…) from src/content/pages; components/ + widgets/, types/, utils/
│   ├── products/            ProductsPage.tsx (DataHub's own page) — api/productsApi.ts, hooks/useProducts.ts,
│   │                        data/mockProducts.ts, types/product.ts, components/ (ProductCard, ProductGrid)
│   └── errors/              NotFoundPage.tsx, RouteError.tsx
└── content/                 GENERATED only (pages/*.json, chrome.json, blog/**) — never hand-edit
```

Images and fonts stay in `public/` (generated content references them by URL). Create a folder only when it has files.

### Where is…?

| I want to… | Go to |
| --- | --- |
| Find or add a URL | `src/core/routes/paths.ts` (`ROUTES`) + `src/core/config/pages.ts` (locales, SEO title/description) |
| See how a URL is rendered | `src/core/routes/index.tsx`: `home` → `modules/home/HomePage`, `products` → `modules/products/ProductsPage`, every other route → `modules/page-blocks/BlockPage` (document `src/content/pages/<routeKey>.<locale>.json`), `/<slug>/` → `modules/blog/BlogPostPage` |
| Manage blog posts | `/admin/` (see "Blog & admin" below); data access only through `modules/blog/api/blogApi.ts` |
| Add or change a product | `src/modules/products/data/mockProducts.ts` (until a backend exists) — see "Products" below |
| Write an API call | `src/modules/<module>/api/` — e.g. `modules/contact/api/appointment.ts` (`submitAppointment`) |
| Change a translation | `src/i18n/locales/en.json` + `ar.json` (same key in both; add new keys to `UiStrings` in `i18n/index.ts`) |
| Change page copy | Generated pages: regenerate (`npm run pages:convert`). Homepage: `modules/home/data/homeContent.ts` |
| Change the menus / footer links | `src/core/config/navigation.ts` (data) and `src/modules/layout/` (components) |
| Change colors, fonts, breakpoints | `src/core/theme/` |

### Rules

- **A module owns everything only it uses**: components, `api/`, `data/`, `types/`, `utils/`, `hooks/`, `schemas/`.
- **`modules/shared`** holds components used by two or more modules; it never imports another module. Don't move
  something there "in case".
- **Modules use each other only through `index.ts`** (`import { BlogCard } from '@/modules/blog'`), never through
  internal paths. A module has an `index.ts` only if another module needs something from it: today `blog` (BlogCard,
  BlogGrid, useLatestPosts, the blog service for the admin), `contact` (form, consultation band, contact data) and `errors` (NotFoundPage).
- **Routed pages are explicit files** (`HomePage.tsx`, `BlockPage.tsx`, `BlogPostPage.tsx`, `NotFoundPage.tsx`) with a
  default export, lazy-loaded by `core/routes/index.tsx`. Never route to a module's `index.ts` — a lazy import of a
  barrel pulls everything it exports into that page's chunk.
- **`core` never imports `modules`**, except `core/routes/index.tsx`. Only `App.tsx` imports the router; everything
  else imports URLs from `@/core/routes/paths` (this prevents import cycles).
- **`i18n` imports nothing from `core` or `modules`.**
- **API calls** live in the owning module's `api/`. There is no shared HTTP client (the site makes one request); add one
  to `core/helpers/` only when two modules need the same request handling.
- All boundaries are enforced by `no-restricted-imports` overrides in `.oxlintrc.json` (`npm run lint`).

### Import conventions

- Use the `@/` alias for anything outside the current folder; `./x` only within a folder.
- Inside a module, import its own files directly (`@/modules/blog/data/blog`).
- `index.ts` files are pure re-exports. `vite.config.ts` marks them side-effect free, so importing one never pulls the
  module's other files into the importing page's chunk.

### Adding things — examples

- **A page of the original site** (most common): add the key + URL to `ROUTES` in `core/routes/paths.ts` and its
  locales/SEO to `core/config/pages.ts`, then `npm run pages:convert -- <routeKey>`. `BlockPage` renders it — no new
  module or route code.
- **A hand-built page**: create `modules/<name>/<Name>Page.tsx` (default export, renders `<PageSeo routeKey="…" />`),
  add its key to `ROUTES`/`PAGES`, declare `const NamePage = lazy(() => import('@/modules/<name>/<Name>Page'))`,
  and map it in `DEDICATED_PAGES` in `core/routes/index.tsx`: `<key>: NamePage`.
- **An API call**: `modules/<module>/api/<thing>.ts` exporting a plain async function (read env vars with
  `import.meta.env`); call it from the module's components. Keep it out of components and `data/`.
- **A translation**: add the key to `UiStrings` in `i18n/index.ts`, then to both `locales/en.json` and `locales/ar.json`.
- **A reusable component**: `modules/shared/<Name>.tsx` once a second module needs it; until then keep it in its module.
- **A new module**: `modules/<name>/`; add an `index.ts` only when another module needs it, and copy an existing
  module's override in `.oxlintrc.json` (replace the module name).

## Blog & admin (`modules/blog`, `modules/admin`)

- **One data source:** every blog read and write goes through `modules/blog/api/blogApi.ts`. Public functions
  (`getPublishedPosts`, `getPublishedPostBody`, `getLatestPublishedPostsNow`) return **published** posts only; admin
  functions: `getAllPosts`, `getPostById`, `createPost`, `updatePost`, `deletePost`, `setPostStatus`, `getCoverLibrary`,
  `getTaxonomy`. Moving to a backend = replace these bodies with REST calls returning the same types.
- **Mock storage (temporary):** the exported posts (`src/content/blog`, never edited) are the initial data; admin
  changes are stored in this browser's localStorage (`data/blogStore.ts`: new/edited posts, deleted ids, draft
  status). Uploaded images are resized to ≤1170px WebP data URLs; a full storage is reported, never silently ignored.
- **Public pages are unchanged:** `BlogGrid`, `BlogPostPage` (via `data/blog.ts`, cached per blog change) and the
  homepage's `BlogSection` (`useLatestPosts`) read through the service. Card images keep the 370×207 / 370×230 ratio
  for any upload. Drafts and deleted posts are 404s. Article HTML from the editor is sanitized (`utils/sanitizeHtml.ts`).
- **Slugs** are unique and may not reuse a site URL's first segment (posts live at `/<slug>/`).
- **Admin** (`/admin/login/`, `/admin/blogs/`, `/admin/blogs/new/`, `/admin/blogs/:id/edit/`, `ADMIN_ROUTES`): English only,
  own layout (not `SiteLayout`), lazy-loaded, `noindex`. `AdminLayout` guards every page but sign-in. Mock
  sign-in lives only in `modules/admin/api/authService.ts` (dev credentials, 8-hour session in localStorage) — to be
  replaced by the backend. Available in development; production builds only with `VITE_ENABLE_ADMIN=true`.
- **Editor:** TipTap (`@tiptap/*`, admin chunk only — excluded from the `react` manual chunk in `vite.config.ts`) with
  headings, lists, quotes, links, images, tables and an HTML source mode; it uses the article page's `articleSx`.

## Products (`modules/products`)

- **Data flow:** `ProductsPage` / `ProductCard` → `hooks/useProducts` (loading, error, one shared request) →
  `api/productsApi` (`getProducts`, `getProductBySlug`) → `data/mockProducts`. Components never import the mock data;
  `productsApi.ts` is the only file that knows where products come from. Moving to a backend = replace its function
  bodies with HTTP calls returning the same `Product` type.
- **Add a product:** append an entry to `MOCK_PRODUCTS` (`types/product.ts` describes every field; all text is
  `Localized<string>`, i.e. `{ en, ar }`). It appears on the page automatically, ordered by `displayOrder`. Add `logo`
  only with real artwork (cards show an initials badge until then) and `links` only with real destinations.
- **Status** (`available` / `in-development` / `coming-soon`) drives the card's chip; only `available` products may be
  described as usable. Page labels (title, intro, status names) are in `i18n/locales/*.json` under `products`.
- **Not products:** administrative portals (e.g. the DataHub HR Admin Portal) stay out of the catalogue.

## HR Admin Portal link

- The header (desktop and mobile) has an **HR Portal / بوابة الموارد البشرية** item (`kind: 'app'` in
  `core/config/navigation.ts`) that opens `<VITE_HR_ADMIN_PORTAL_URL>/login` in the same tab
  (`core/config/hrAdminPortal.ts`). Dev default: `http://localhost:5174`. A production build without the variable
  **hides** the item. See `.env.example`.
- Navigation only: no SSO, tokens or session data are shared with the portal (that comes with the shared backend).

## Content pipeline (inner pages)

- The homepage is hand-built (`src/modules/home`, copy in `src/modules/home/data/homeContent.ts`).
- Every other page is a **page document** (`src/content/pages/<routeKey>.<locale>.json`, typed in
  `src/modules/page-blocks/types/blocks.ts`) generated by `scripts/convert-pages.ts`: it walks the original WPBakery DOM in Chromium
  (rows → columns → widgets), captures each element's computed styles at 1440/800/390px, sanitizes HTML, rewrites
  links to locale-neutral paths and downloads assets to `public/assets/uploads/` (original paths kept).
- `src/modules/page-blocks/BlockPage.tsx` renders documents with the module's widgets (one MUI component per theme widget).
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
