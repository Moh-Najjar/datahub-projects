# CLAUDE.md — DataHub HR Admin Portal (apps/datahub-hr-admin-portal)

The administrative web frontend of the **DataHubHR** platform (the mobile app `apps/datahub-hr` is the
employee/manager frontend; both will consume the same future HR backend).

- **Original product.** Comparable in scope to established HR suites, but never copy another vendor's code, branding,
  logos, text or exact screen designs.
- **Status: Phase 4 — HR dashboard.** Foundation (theme, EN/AR + RTL, routing, TanStack Query, mock API toolkit),
  the signed-in shell, demo sign-in for every role, permission guards, profile page, and the role-based HR dashboard
  (KPIs with trends, four Apache ECharts charts, pending actions, recent activity). HR modules come in approved
  phases (5 organization → employees → attendance → leave; payroll/recruitment/performance later).
  **Never create a module, folder or screen ahead of its phase.**
- **No backend yet.** All data comes from the in-browser **mock API** with **fictional** data.

## Commands (from the monorepo root)

| Command | Purpose |
| --- | --- |
| `npm run dev:admin` | Vite dev server → <http://localhost:5174> |
| `npm run build:admin` | `tsc -b` + production build |
| `npm run lint:admin` | oxlint, including architecture boundaries |
| `npm run test:admin` | Vitest (jsdom + Testing Library) |
| `npm run typecheck` | TypeScript for every workspace |

Before finishing any change: `npm run typecheck && npm run lint:admin && npm run test:admin && npm run build:admin`.
Install packages with `npm install <pkg> --workspace=apps/datahub-hr-admin-portal` — only when a phase needs them.

## Stack

React **19.3.0** (pinned for the whole monorepo by Expo SDK 58) · TypeScript 6 (root) · Vite 8 · Material UI 9 ·
React Router 7 · TanStack Query 5 · i18next + react-i18next · Emotion + `stylis-plugin-rtl` (`stylis` stays 4.2.x) ·
self-hosted Inter + IBM Plex Sans Arabic (`@fontsource`) · React Hook Form + Zod · `@mui/icons-material` · Vitest.
Charts: **Apache ECharts** (`echarts` + `echarts-for-react`) — do not add `@mui/x-charts` or other chart libraries.
Planned per phase: MUI X Data Grid / Date Pickers + dayjs (5) — MIT editions only.
`react-hook-form`/`@hookform/resolvers` are shared with the website: install them at the versions already in the
lockfile so the website's resolved versions never change.

## Architecture

```
src/
├── main.tsx, App.tsx      fonts + i18n init; providers: QueryClient → AuthProvider → theme → router
├── core/                  application infrastructure — never imports modules (except the router)
│   ├── api/               API contracts (ListParams, Paginated, ApiError), queryClient, mock/ toolkit
│   ├── config/            permissions.ts — roles, permissions, role → permission matrix
│   ├── context/           authContext.ts (Session types, useAuth), AuthProvider.tsx (session state)
│   ├── guards/            RequireAuth / RedirectIfAuthenticated, RequirePermission (UI only)
│   ├── routes/            index.tsx = the router; navigation.ts = nav map (sidebar, breadcrumbs, guards)
│   └── theme/             tokens.ts (design tokens, light + dark), theme.ts, emotionCache.ts (RTL), AppThemeProvider
├── i18n/                  i18next setup, languages, format (Latin digits), locales/<lang>/<namespace>.json
├── modules/               all product functionality, one folder per module
│   ├── shared/            reusable UI: LanguageSwitcher, ThemeModeSwitcher, DemoModeNotice, BrandMark, PageHeader
│   ├── layout/            AppLayout, Sidebar, TopBar, AppBreadcrumbs, UserMenu
│   ├── auth/              LoginPage, ProfilePage, api/authApi (mock), mock/demoAccounts, hooks, schemas, components
│   ├── dashboard/         DashboardPage, access.ts (widget → permissions), api/, hooks/, mock/, types/, utils/,
│   │                      charts/ (ECharts setup + pure option builders), components/ (+ components/charts/)
│   └── errors/            NotFoundPage, AccessDeniedPage, RouteError
└── test/                  setup.ts, matchMedia.ts (jsdom stand-in), renderApp.tsx (routes + providers, sign in as a role)
```

Layers: **`i18n` ← `core` ← `modules` ← `core/routes/index.tsx`** (enforced by `.oxlintrc.json`).

- `core/` = infrastructure only (api toolkit, auth session + guards, permission model, routing, theme). No business
  code; it never calls a module's API (sign-in itself lives in `modules/auth`, which hands the session to `signIn`).
- A module owns its `components/`, `hooks/`, `api/`, `mock/`, `types/`, `schemas/` — folders created only when used.
  Routed pages are explicit files (`EmployeesPage.tsx`, default export) lazy-loaded by the router.
- Modules use each other only through `index.ts` (`import { … } from '@/modules/organization'`); `index.ts` exists only
  when another module needs something. Reusable admin UI goes to `modules/shared/` once two modules need it.
- Import with the `@/` alias; `./x` only within a folder. No top-level `pages/`, `features/` or `shared/`.

## API calling — UI → hook → API service → mock

```
EmployeesTable  →  useEmployees(params)       (modules/employees/hooks — TanStack Query)
                →  employeesApi.list(params)   (modules/employees/api — typed, the ONLY data entry point)
                →  mock handlers + data        (modules/employees/mock — fictional, in memory)
```

1. Components never import `mock/` (or call the API service directly); they use the module's hooks.
2. Hooks own server state: `useQuery` with a query key per module (`['employees', 'list', params]`), `useMutation` +
   `invalidateQueries` for writes. Loading/error states come from TanStack Query — don't duplicate them in `useState`.
3. API services return typed contracts from `core/api/types.ts`: lists take `ListParams` (`page` is **1-based**,
   `pageSize`, `search`, `sortBy`/`sortDirection`, `filters`) and return `Paginated<T>`; every failure is an `ApiError`
   (`code`, HTTP-like `status`, optional `fieldErrors`). UI messages come from `common:apiErrors.<code>`.
4. `queryClient.ts` defaults: 30 s `staleTime`, de-duplicated requests, no retry on 4xx, 2 retries on network/server
   errors, no automatic mutation retries.
5. **Switching to the real backend** = replacing each `api/*.ts` body with HTTP calls returning the same types (add
   `core/api/http.ts` then). Never invent backend endpoints before the backend contract exists.

### Mock API conventions (`core/api/mock/`)

- `mockRequest(handler)` — wraps every simulated call: random 200–600 ms delay (abortable), optional failures,
  deep-cloned result. Handlers throw `ApiError` for business errors (`NOT_FOUND`, `CONFLICT`, `VALIDATION`…).
- `queryCollection(items, params, { searchFields, matches })` — search → filters → sort → 1-based pagination.
- `createMockStore(seed, idPrefix)` — in-memory table per module: `all/get/create/update/remove/reset` and
  `transition(id, allowed, patch)` for approve/reject workflows (throws `CONFLICT` from the wrong state).
- `mockConfig` — `setMockConfig({ delayMs, failureRate })`, `failNextRequest(code)` to exercise error states.
- Data is **fictional**, lives in `modules/<module>/mock/` (one seed per module — no global mock file), stays in memory
  and resets on reload. Never persist HR-like data to browser storage. Label simulated behaviour as simulated.
- Never use public/third-party APIs as a substitute for the HR backend, and never send HR data to them.

## Routing

The router is `core/routes/index.tsx` (`createBrowserRouter`; tests use the exported `routes` with a memory router);
each page is `lazy()`-loaded into its own chunk. URLs are English-only (`/employees/:id`); the language is a user
preference, not part of the URL.

- `/login` (public; signed-in users are redirected) → signed-in shell (`RequireAuth` + `AppLayout`): `/` redirects to
  the role's landing page (first available nav item: dashboard, or profile for Employee), `/dashboard`, `/profile`,
  and a 404 inside the shell.
- **`core/routes/navigation.ts` is the single map** of pages: path, icon, required permissions (`anyOf`) and
  `available`. The sidebar shows the items the role may see; planned areas are listed disabled ("Soon") so roles see
  their future scope — never link them before the module exists. Breadcrumbs read `handle.navKey` set by `navRoute()`.
- **Adding a page:** set its nav item `available: true`, add `navRoute('<key>', LazyPage)` in the router (it wraps the
  page in `RequirePermission`, falling back to the access-denied page), add its `nav.items.<key>` label (EN + AR).

## Authentication and roles (Phase 3 — MOCK)

- **Mock sign-in only**, under the permanent "Demo Mode — Not Real Authentication" warning (full notice on the
  sign-in page, badge in the app bar). `modules/auth/api/authApi.ts` selects a demo account by email; **any password
  is accepted and is never stored, logged or compared.** The token is a random `mock-…` placeholder.
- Session: `AuthProvider` keeps it in `sessionStorage` (`datahub-hr-admin.session`, ends with the tab), validates its
  shape on load, expires it after 8 h and clears the TanStack Query cache on sign-out.
- Demo accounts (fictional, `@demo.datahubhr.test`): `sysadmin` (System Administrator), `hr.admin` (HR Administrator),
  `hr.manager` (HR Manager), `dept.manager` (Department Manager), `employee` (Employee), `recruiter` (Recruiter),
  `payroll` (Payroll Officer). One-click buttons for each on the sign-in page.
- Roles → permissions: `core/config/permissions.ts` (`ROLE_PERMISSIONS`, tested in `permissions.test.ts`).
  Permission strings are `<area>:<action>` (organisation-wide) with `:team` / `:own` scoped variants; every role has
  self-service (`profile:view`, own attendance/leave). Check with `useAuth().can(p)` / `canAny([...])`.
- **Route guards, hidden nav items and filtered dashboard tiles are UI conveniences, not security.** Real
  authentication and authorization (including team/self scoping of data) must be enforced by the backend on every
  request; nothing in this app may be presented as production security. Replace mock sign-in only with the backend's.

## i18n, RTL/LTR

- i18next + react-i18next; translations bundled in `src/i18n/locales/{en,ar}/<namespace>.json` — `common` (shell,
  navigation, roles, permissions, errors), `auth`, `dashboard`; one namespace per module when it needs one — register
  it in `i18n/index.ts` and `i18n/i18next.d.ts`. Use `useTranslation('<namespace>')`.
- Keys are type-checked (`t('nav.items.dashboard')`); EN and AR must have identical keys (enforced by a test).
  i18next uses `:` as namespace separator, so permission labels are keyed with `_` (`permissions.leave_approve_team`).
  Use interpolation and i18next plurals (Arabic has six forms) instead of concatenating strings.
- English is the default; the choice is stored in `localStorage` (`datahub-hr-admin.language`) and applied to
  `<html lang dir>`. Use `useLanguage()` for the active language/direction, `changeLanguage()` to switch.
- Numbers and dates: `formatNumber` / `formatDate` from `i18n/format.ts` — Arabic keeps **Latin digits (0–9)**.
- RTL: the theme's Emotion cache mirrors physical `left/right` automatically — write styles in LTR terms, don't use
  logical `inset-inline-*`/`margin-inline-*` in Emotion styles, and flip direction-sensitive icons via `theme.direction`.

## MUI design conventions

- Design tokens live in `core/theme/tokens.ts` (colours, type scale, spacing unit 8px, radius, shadows, breakpoints);
  components use them only through the theme (`palette`, `spacing`, `shape`, `typography`), never raw hex values.
- Use MUI components directly (no wrappers around Button/TextField/etc.); add theme `components` overrides for global
  look. Prefer plain pages with sections and tables over stacks of cards and dialogs.
- Every data view needs loading, empty and error states; destructive actions need a confirmation dialog.
- Light/dark: MUI colour schemes as CSS variables (`<html data-color-scheme>`), light by default, choice remembered by
  MUI under `datahub-hr-admin.color-mode`; switch with `useColorScheme()` (`ThemeModeSwitcher`). Dark-only styles use
  `theme.applyStyles('dark', …)`. Both schemes' foreground colours are checked for WCAG AA (see `tokens.ts`).

## Dashboard (`modules/dashboard`)

- **Data flow:** each section is one query — `components/*` → `hooks/useDashboard.ts` (`useDashboardSummary`,
  `useEmployeeGrowth`, `useAttendanceOverview`, `useDepartmentHeadcount`, `useLeaveOverview`, `useRecentActivity`,
  `usePendingActions`; keys `['dashboard', <resource>, <scope>]`, 60 s freshness for aggregates) →
  `api/dashboardApi.ts` → `mock/dashboardMock.ts`. Response types: `types/dashboard.ts` (draft backend contract).
- **Consistent figures:** `mock/dataset.ts` is the single fictional source (8 departments, seeded PRNG, 24 months of
  hires/exits). Organisation figures are sums of departments; headcount history is rebuilt backwards from today, so
  KPIs, charts and pending actions always agree (`dashboardMock.test.ts` checks this). Never hard-code a figure.
- **Roles:** `access.ts` maps widgets, activity types and pending actions to EXISTING permissions; hooks get
  `enabled: false` for widgets the role cannot see (nothing is fetched). Scope: organisation for HR/payroll/recruitment
  roles, own department for Department Managers; Employees have no dashboard. The backend must enforce the same.
- **Charts (Apache ECharts):** `charts/echarts.ts` registers only Line/Bar/Pie + Grid/Tooltip/Legend + the SVG
  renderer. `charts/options.ts` holds pure option builders (data + `ChartContext` {mode, direction, language} → option)
  using `chartColors` from `core/theme/tokens.ts` (light + dark, ≥ 3:1 contrast). `components/charts/EChart.tsx` renders
  with `autoResize` (ResizeObserver) and `notMerge`; `ChartCard` provides loading / error + retry / empty states.
  Import the React wrapper from `echarts-for-react/esm/core` — the CommonJS `lib/core` breaks in the production bundle.
- **Charts and RTL:** ECharts never mirrors itself. The chart surface is always `dir="ltr"` (inherited RTL misplaces SVG
  text); builders mirror explicitly — category axes `inverse`, value axes on the right, legends right-aligned and
  reversed, legend text with the name last, tooltips `direction: rtl`. Numbers via `formatNumber` (Latin digits).
- **Bundle:** ECharts stays inside the lazy `DashboardPage` chunk (~211 kB gzip) — never make it a manual chunk (the
  bundler then pulls shared helpers into it and every page preloads it). `chunkSizeWarningLimit` is 650 kB for this.
- **Tests:** `src/test/echartsStub.ts` replaces `echarts-for-react` in jsdom and records each chart's props (data,
  colours, RTL, resize). `charts/options.test.ts` renders every option with the REAL engine (ECharts SSR → SVG).
  Always also check charts in a real browser (EN/AR, light/dark): stubs cannot catch rendering or bundling bugs.

## Security (even with mock data)

- No real employee data, no real personal data — fictional seeds only.
- No passwords stored in plain text (or at all) in mock auth; mock tokens are clearly mock.
- `VITE_*` variables are public: never put secrets or API keys in them (or anywhere in this frontend).
- Never present client-side checks or mock auth as production-ready security.

## Relationship with other workspaces

- Never import website or DataHubHR code (lint-enforced); never share UI with React Native.
- `@datahub/shared-types` only for contracts both frontends genuinely consume (today: `Locale`, `Direction`).
  The API types written here are drafts of the future shared contract; promote one only when the mobile app uses it.
