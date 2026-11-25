# CLAUDE.md — DataHub Website

Faithful recreation of <https://datahubanalytics.com/> (a WordPress/Mitech site) in React 19 + TypeScript + Vite + **Material UI**.
This is a **recreation, not a redesign**: the live site is the source of truth for content, layout, spacing and behaviour.
DataHub may add **its own pages** that the original site doesn't have (none at the moment — the former Products page was
removed on 2026-11-24), built in the same visual identity. Full plan and decisions: [docs/PLAN.md](docs/PLAN.md).

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Vite dev server (port 3000) |
| `npm run build` | Type-check (`tsc -b`) + production build |
| `npm run typecheck` / `npm run lint` | TypeScript (strict) / oxlint |
| `npm test` | Vitest (jsdom + Testing Library): backend API layers and the screens that use them |
| `npm run assets` | Download original public assets listed in `scripts/assets.manifest.ts` into `public/` (idempotent) |
| `npm run pages:convert -- [routeKey…]` | Re-generate inner-page documents from the live site (see "Content pipeline") |
| `npm run screenshot -- <url> <outDir> [width]` | Playwright viewport-chunk screenshots for visual comparison |

Run `npm run typecheck && npm run lint && npm test && npm run build` before considering any change done.

## Non-negotiable rules

1. **No invented content.** Every string, number, image and link on a **recreated** page must come from the original site.
   Keep the original's wording verbatim (including its typos, e.g. "Big Data Analyics"). If something can't be obtained,
   say so — don't guess. **Exception — DataHub's own pages** (none at the moment): their copy is written by
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
  With the added Workspace (Portals) item, top-level menu items use tighter spacing from 1200px until the
  menu fits with the original spacing (`ROOMY_FROM` in `Navigation/DesktopNav.styles.ts`: 1580px EN, 1800px AR — measured while a Products item still existed, so the narrower menu fits safely),
  and the Workspace item is an icon (label as tooltip/accessible name) below 1440px. Re-check the fit (EN and AR,
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
├── App.tsx                  <QueryClientProvider> + <RouterProvider router={router} />
├── core/                    application infrastructure — never imports modules (except the router)
│   ├── routes/
│   │   ├── index.tsx        the router: lazy-loads each module's page, /ar tree, legacy redirects, 404
│   │   └── paths.ts         ROUTES (every URL), LEGACY_REDIRECTS, EXTERNAL_LINKS
│   ├── config/              pages.ts (locales + SEO per route), navigation.ts (menus, footer columns), api.ts (API base URL)
│   ├── helpers/             http.ts (the ONE HTTP client of the backend API), queryClient.ts (TanStack Query defaults)
│   ├── api/                 backend API functions + their request/response types (blogs.ts, auth.ts)
│   ├── theme/               MUI theme, tokens, RTL Emotion cache, AppThemeProvider
│   ├── hooks/               useCountUp, useRouteKey; TanStack Query hooks of the backend API (useBlogs, useAdminBlogs)
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
│   ├── blog/                BlogPostPage.tsx, ArabicPostRedirect.tsx, components/ (BlogGrid, BlogCard, PostImage),
│   │                        utils/ (sanitizeHtml, articleStyles, date) — renders API data from core/hooks/useBlogs
│   ├── admin/               /admin/ = Blogs Admin: AdminLayout (guard = backend Workspace session + permission) + pages,
│   │                        components/ (BlogForm, RichTextEditor, CoverField), schemas/, hooks/ (useBlogPermissions), data/, utils/
│   ├── portals/             /workspace/ — central staff sign-in (backend) + application launcher: WorkspaceLayout,
│   │                        Workspace{Login,Logout,Open}Page, WorkspacePage; api/ (workspaceAuth, hrHandoff, sessionBridge),
│   │                        data/ (accounts, applications), components/, hooks/
│   ├── contact/             api/appointment.ts, components/ (AppointmentForm, ConsultationSection), schemas/, data/
│   ├── page-blocks/         BlockPage.tsx — renders every generated page (about-us, services, solutions, contact,
│   │                        careers, blog list…) from src/content/pages; components/ + widgets/, types/, utils/
│   └── errors/              NotFoundPage.tsx, RouteError.tsx
└── content/                 GENERATED only (pages/*.json, chrome.json) — never hand-edit. Blog posts come from the API.
```

Images and fonts stay in `public/` (generated content references them by URL). Create a folder only when it has files.

### Where is…?

| I want to… | Go to |
| --- | --- |
| Find or add a URL | `src/core/routes/paths.ts` (`ROUTES`) + `src/core/config/pages.ts` (locales, SEO title/description) |
| See how a URL is rendered | `src/core/routes/index.tsx`: `home` → `modules/home/HomePage`, every other route → `modules/page-blocks/BlockPage` (document `src/content/pages/<routeKey>.<locale>.json`), `/<slug>/` → `modules/blog/BlogPostPage` |
| Manage blog posts | `/admin/` (see "Blog & admin" below); data only through `core/hooks/useAdminBlogs.ts` (backend API) |
| Change who may open an internal application | `src/modules/portals/data/applications.ts` (see "Portals" below) |
| Write an API call | Backend API: `core/api/<resource>.ts` + a hook in `core/hooks/` (see Rules). Other endpoints: the module's `api/` (e.g. `modules/contact/api/appointment.ts`) |
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
  BlogGrid, PostImage, sanitizeHtml for the admin), `portals` (session, permissions for the admin), `contact` (form, consultation band, contact data) and `errors` (NotFoundPage).
- **Routed pages are explicit files** (`HomePage.tsx`, `BlockPage.tsx`, `BlogPostPage.tsx`, `NotFoundPage.tsx`) with a
  default export, lazy-loaded by `core/routes/index.tsx`. Never route to a module's `index.ts` — a lazy import of a
  barrel pulls everything it exports into that page's chunk.
- **`core` never imports `modules`**, except `core/routes/index.tsx`. Only `App.tsx` imports the router; everything
  else imports URLs from `@/core/routes/paths` (this prevents import cycles).
- **`i18n` imports nothing from `core` or `modules`.**
- **Backend API (DataHub Analytics API) — four layers, nothing skipped:** `core/helpers/http.ts` (generic
  `http.get/post/put/delete`: base URL, query strings, JSON bodies — DELETE too —, unwraps the
  backend envelope `{ success, data, error, meta }`, errors → `HttpError` with `status` (0 = no answer) / `code` (e.g.
  `Cms.ConcurrencyConflict`) / field `errors`; never cookies — `credentials: 'omit'`) → `core/api/<resource>.ts` (endpoints,
  request / response types as the backend sends them) → `core/hooks/use<Resource>.ts` (TanStack Query: keys,
  caching, pagination, invalidation) → UI. Components never call `http` or an API function directly.
- **Authentication in the HTTP layer:** requests made with `auth: true` get `Authorization: Bearer <access token>`.
  `core` doesn't know the session: the Workspace (`modules/portals/api/workspaceAuth.ts`) registers the token provider
  with `configureHttpAuth`. Without a token the request is not sent (`HttpError` 401); a 401 answer ends the
  Workspace session (guards then ask to sign in again). Never write tokens or credentials into code or env files.
- Base URL: `VITE_API_URL` (`core/config/api.ts`, `.env.development` / `.env.production`). In development the browser
  calls its own origin and Vite proxies `/api`. Production calls the API directly: **the deployed origin must be in the
  API's CORS list** (as of 2026-11-22 it allows `http://localhost:3000` only — not `datahubanalytics.com`). Defaults
  (`queryClient.ts`): 5 min freshness, no refetch on focus, 2 retries for network/5xx, 3 for 429 (the API rate-limits
  per IP, ~30 s window, no `Retry-After`), none for other 4xx.
- Other requests (the appointment form's `VITE_FORM_ENDPOINT`) stay in their module's `api/`.
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
- **A backend API call**: function in `core/api/<resource>.ts` + hook in `core/hooks/` (see Rules). Other endpoints:
  `modules/<module>/api/<thing>.ts` exporting a plain async function; keep it out of components and `data/`.
- **A translation**: add the key to `UiStrings` in `i18n/index.ts`, then to both `locales/en.json` and `locales/ar.json`.
- **A reusable component**: `modules/shared/<Name>.tsx` once a second module needs it; until then keep it in its module.
- **A new module**: `modules/<name>/`; add an `index.ts` only when another module needs it, and copy an existing
  module's override in `.oxlintrc.json` (replace the module name).

## Blog & admin (`modules/blog`, `modules/admin`)

- **One data source: the backend API** (no local posts, no mock, no fallback). Endpoints (verified 2026-11-22; moved under `/api/v1` on 2026-11-24, see
  `core/api/blogs.ts`): public `GET /api/v1/blogs?pageNumber&pageSize` (1–100, published only) and `GET /api/v1/blogs/{slug}`
  (404 `Cms.BlogNotFound` for unknown slugs and drafts), `GET /api/v1/blogs/categories` and `GET /api/v1/blogs/tags` (every
  category / tag: `{ id, name, slug, description }`; posts carry `{ id, name, slug }`); admin (Bearer) `GET /api/v1/admin/blogs?pageNumber&pageSize&search&status`,
  `GET/PUT/DELETE /api/v1/admin/blogs/{id}`, `POST /api/v1/admin/blogs` (creates a draft → `{ id }`), `POST …/{id}/publish` and
  `…/unpublish`. Writes answer 204 without a body.
- **Public pages** (`core/hooks/useBlogs.ts`): `BlogGrid` (`/blog/`, 10 per server page, infinite loading + "Load
  more"), `BlogPostPage` (`/<slug>/`, HTML sanitized before rendering, 404 → the 404 page), homepage `BlogSection`
  (first 3). Loading / error (with retry) / empty states are localized (`UI.blog`). **Nothing is invented:** a missing
  excerpt, date or author is left out, a missing image shows the neutral `PostImage` panel; the post page shows its
  categories above the title and its tags in the footer (as on the original), each only when there are some. Footer as on
  the original: tags + "Share this post" (`components/ShareButton.tsx`: round button → bubble with Twitter / Facebook /
  LinkedIn, click to open, Escape / click away to close), then the previous (older, left) and next (newer, right) post
  cards (`components/PostNavigation.tsx`). The backend has no "neighbours" endpoint: `useBlogIndex` loads every published
  post's list item (pages of 100, cached) and `utils/neighbours.ts` finds them in the API's order — so neighbours follow
  that order (newest first; posts with the same date by title). The list order is the API's.
- **Back to top** (`modules/layout/BackToTop.tsx`, in `SiteLayout` → every public page): the original's 60px blue circle,
  shown after 200px of scrolling, arrow slides up on hover, smooth scroll (instant with reduced motion), mirrored in Arabic.
- **Slugs** must match `SLUG_PATTERN` and may not reuse a site URL's first segment (`RESERVED_SLUGS`,
  `admin/schemas/blogPostSchema.ts`; includes `tags` / `categories`, the API's list routes); uniqueness is the backend's (409 `Cms.DuplicateSlug` → slug field error).
- **Blogs Admin design:** `/admin/` uses the DataHub admin design language (violet) shared with the HR Admin Portal and the Trainee App, NOT the public site's Satoshi/5px theme: `modules/admin/adminTokens.ts` + `adminTheme.ts` are generated from the Trainee App's `core/theme` (tokens copied; theme converted to a standalone, English-only `createTheme(options)` — `createTheme(base, …)` cannot change spacing or breakpoints). Shell: full-width `AdminTopBar` (breadcrumbs "DataHub Blogs › Blog posts › …", Portals outlined, the primary action "New post" for `cms.blogs.create`, account menu) above a compact `AdminSidebar` ("DataHub Blogs" wordmark, uppercase groups, text-only items; no account block). Inter is imported only by the admin chunk. Mirror token / theme / shell changes in the other two apps.
- **Admin = "Blogs Admin"** (`/admin/blogs/`, `/admin/blogs/new/`, `/admin/blogs/:id/edit/`, `ADMIN_ROUTES`): English
  only, own layout (not `SiteLayout`), lazy-loaded, `noindex`. **No separate sign-in:** `AdminLayout` requires a
  **backend** Workspace session whose portals include `blogs-admin` and whose token has `cms.blogs.view`; signed-out
  (or expired / refused token) → `/workspace/login/` then back; otherwise → `/workspace/` with a notice. Actions follow
  the token's permissions (`hooks/useBlogPermissions.ts`): `cms.blogs.create` (New post), `.update` (edit), `.publish`
  (publish / unpublish, status field), `.delete`. The backend enforces them anyway (403 → message). Sign-out is
  `/workspace/logout/`. Available in development; production builds only with `VITE_ENABLE_ADMIN=true`.
- **List:** search (debounced), status filter and paging run on the server; totals come from three one-row requests.
- **rowVersion:** the editor sends the `rowVersion` it was opened with (captured once by `BlogForm`), so a change made
  meanwhile is refused (409 `Cms.ConcurrencyConflict`) — shown with "Load the latest version", never retried. List
  actions have no rowVersion in the list: they read the post's current one right before the change. After every change
  the admin list, the post and all public blog queries are invalidated. Saving with another status = save, read the
  new rowVersion, publish/unpublish (`BlogStatusNotChangedError` if only that last step fails).
- **Form fields = what the backend stores:** title, slug, excerpt (optional), article HTML (sanitized before sending),
  featured image **URL** (picked from the collection of images other posts use, or typed — no upload endpoint), meta
  title, meta description, canonical URL, and **categories / tags** chosen from the backend's lists
  (`components/TaxonomyField.tsx`; sent as `categoryIds` / `tagIds`; new ones are created in the backend, not here).
  Unknown ids are refused (400 `Cms.InvalidTaxonomy` → message), so never invent ids. Authors: `authorId` stays `null`
  (no list of authors yet).
- **Editor:** TipTap (`@tiptap/*`, admin chunk only — excluded from the `react` manual chunk in `vite.config.ts`) with
  headings, lists, quotes, links, images, tables and an HTML source mode; it uses the article page's `articleSx`.

## Portals — central staff sign-in (`modules/portals`)

One sign-in for DataHub's internal applications: Main website → **Portals** → sign-in (if needed) → dashboard →
application. Every account is a backend account (`api/workspaceAuth.ts`); there are no demo accounts.

- **Header:** **Portals / البوابات** (`kind: 'app'` in `core/config/navigation.ts`, after Contact Us) — replaced
  the former HR Portal link; icon below 1440px like before. It links to `/workspace/` (`/ar/workspace/` in Arabic).
- **Routes** (`WORKSPACE_ROUTES`, outside `SiteLayout` and the page catalogue, EN + AR, `noindex`, lazy):
  `/workspace/` (dashboard; signed-out → sign-in, then back), `/workspace/login/` (the ONLY sign-in page of every
  application; a "Back to website" button returns to the homepage), `/workspace/logout/` (ends the session, then the sign-in page with a confirmation — every
  application's Sign out lands here), `/workspace/open/<app>/` (opens an application as the signed-in user; sign-in
  first when needed; the cards and the HR portal use it). `workspace` is a reserved blog slug.
- **Session check page** `/workspace-session.html` (second Vite entry, `src/portalsSession.ts` → `api/sessionBridge.ts`,
  no React): embedded hidden by the HR portal; reports the central session (account email + expiry, or `null`) with
  `postMessage` to the HR portal origin only — on load, on request and on every change, also from other tabs.
- **Sign-in** (`WorkspaceLoginPage` → `hooks/useSignIn` mutation → `signIn`): email + password →
  `POST /api/v1/auth/login` (`core/api/auth.ts`; 400 `Authentication.InvalidCredentials` → "email or
  password is incorrect"), then `GET /api/v1/auth/portals` with the new token. The backend session keeps the access token
  (JWT, ~15 min), its expiry (`exp`), the backend roles (`role` = the first one with a label in `data/roles.ts`), the known
  portal keys and the token's `permission` claims (re-read from the token on every load, so storage can't grant more).
  Passwords are never stored.
- **Invitation activation** (`ActivateInvitationPage`, `ACCOUNT_ROUTES.activate` = `/activate/` + `/ar/activate/`, Workspace
  layout, anonymous, `activate` is a reserved blog slug): the backend's invitation e-mail links to `/activate?token=…`.
  New password (≥ 12, `MIN_PASSWORD_LENGTH`) + confirmation → `POST /api/v1/auth/activate-invitation` `{ token, newPassword }`
  (`core/api/auth.ts` → `core/hooks/useActivateInvitation.ts`, never retried) → 204 = activated → success message, then
  the Workspace sign-in (button, or by itself after 6 s). Errors (verified 2026-11-25): 400 `Authentication.InvalidToken`
  (also an empty token) → "invalid or expired" message; 400 `Authentication.WeakPassword` → password field; anything else
  → "could not activate" (`activationFailureOf`). The token is only read from the URL (spaces → `+`: an unencoded `+`
  arrives as a space) and sent to the API — never logged or stored; the page sets `referrer: no-referrer`. The language
  switch keeps the query string. Shares `components/AuthCard` with the sign-in page. Tests:
  `ActivateInvitationPage.test.tsx` (real page + HTTP client; only `fetch` is mocked). The backend must put this site's
  origin in the invitation link (and allow it in CORS).
- **No refresh, no backend logout (backend blocker):** `/api/v1/auth/refresh` and `/api/v1/auth/logout` answer 403 to
  every request form tried (refresh cookie, allowed origin, Bearer — 2026-11-22). So the session ends when the token
  expires (the admin shows the time) or on a 401, and sign-out only forgets the token. The HttpOnly refresh cookie is
  never read or sent (`credentials: 'omit'`). When the backend fixes refresh: call it with `credentials: 'include'` from
  `workspaceAuth.ts` (CORS must allow credentials for the site's origin), nothing else changes.
- Session storage: `localStorage` (`datahub-website.workspace-session`, shared by the site's tabs; sign-out in one tab
  signs out all). The access token is therefore readable by scripts of this origin (accepted for now).
- **Applications and access** (`data/applications.ts`): exactly the portals the backend lists — ids are its keys
  (`hr-admin`, `blogs-admin`, `academy-admin` = Trainee App; verified 2026-11-24). `/workspace/open/trainee-app/` (the
  former id) still works as an alias of `academy-admin`. Cards, the
  Blogs Admin guard and the HR handoff use `canOpen(session, app)` / `applicationsFor(session)`. To add an application:
  its id in `APPLICATION_IDS`, who may open it, strings under `workspace.apps.<id>`, and how `ApplicationCard` opens it.
- **Blogs Admin** (same origin) reads the same session — see "Blog & admin".
- **HR Admin** (another origin, `VITE_HR_ADMIN_PORTAL_URL`, dev default `http://localhost:3001`; production without
  it hides the card): `/workspace/open/hr-admin/` sends the browser to `<portal>/sso#token=…` (`api/hrHandoff.ts`).
  The token — base64url JSON `WorkspaceHandoffPayload` from `@datahub/shared-types`: issuer, account email, ~2-minute
  link expiry and the backend **access token** (never a password) — is created at that moment and travels in the URL
  **hash** (never sent to servers, never in the query string). The portal has **no sign-in form**: it reads the user,
  role, permissions and expiry from the access token, sends signed-out visitors to `/workspace/open/hr-admin/`, and
  follows the central session through the session check page.
- **Sign-out** (Workspace, Blogs Admin or HR Admin) → `/workspace/logout/` → Workspace sign-in. It ends the central
  session; this site's other tabs follow at once (storage event) and open HR tabs follow through the session check
  (they end their session and go back through the Workspace). If another account signs in centrally, an open HR tab
  switches to it. Same-site deployment (e.g. subdomains of one domain) is required for the check: cross-site embeds get
  partitioned storage — the portal then stops after two ended sessions in 30 s (loop guard) and shows a button.
- **i18n:** all Workspace text is in `i18n/locales/{en,ar}.json` under `workspace` (`UiStrings`); `fill()` fills `{…}`
  placeholders. Blogs Admin stays English only.

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
- Blog posts are not generated: they come from the backend API. `npm run check:links` reads their slugs and HTML from
  the API (`VITE_API_URL`; slow on purpose — the API rate-limits).

## Visual comparison workflow

`npm run screenshot -- https://datahubanalytics.com/<path> <dir>/orig 1440` and the same for `http://localhost:3000/<path>`,
then compare chunk by chunk. Check 1920/1440/1280/1024/768/390/375 and both `/` and `/ar/`.
