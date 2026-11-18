# CLAUDE.md — DataHub HR Admin Portal (apps/datahub-hr-admin-portal)

The administrative web frontend of the **DataHubHR** platform (the mobile app `apps/datahub-hr` is the
employee/manager frontend; both will consume the same future HR backend).

- **Original product.** Comparable in scope to established HR suites, but never copy another vendor's code, branding,
  logos, text or exact screen designs.
- **Status: Phase 5 — Organization, Employee, Attendance, Leave, Recruitment, Performance, Payroll and Documents Management done** on top
  of the foundation, shell, demo sign-in, permission guards, profile page and role-based HR dashboard (Phases 2–4).
  Next, only after approval: reports.
- **No backend yet.** All data comes from the in-browser **mock API** with **fictional** data.

## Commands (from the monorepo root)

| Command | Purpose |
| --- | --- |
| `npm run dev:admin` | Vite dev server → <http://localhost:3001> |
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
Lists use MUI `Table` + `TablePagination` (server-side paging/sorting); add MUI X (MIT editions only) only when a
module genuinely needs it (e.g. Date Pickers for attendance/leave).
`react-hook-form`/`@hookform/resolvers` are shared with the website: install them at the versions already in the
lockfile so the website's resolved versions never change.

## Architecture

```
src/
├── main.tsx, App.tsx      fonts + i18n init; providers: QueryClient → AuthProvider → theme → router
├── core/                  application infrastructure — never imports modules (except the router)
│   ├── api/               API contracts (ListParams, Paginated, ApiError), queryClient, mock/ toolkit
│   ├── config/            permissions.ts — roles, permissions, role → permission matrix
│   ├── context/           authContext.ts (Session types, useAuth), AuthProvider.tsx (session state), WorkspaceSessionCheck,
│   │                      breadcrumbContext.ts + BreadcrumbProvider (pages add crumbs after their nav item)
│   ├── guards/            RequireAuth / RedirectIfAuthenticated, RequirePermission (UI only)
│   ├── routes/            index.tsx = the router; navigation.ts = nav map (sidebar, breadcrumbs, guards)
│   └── theme/             tokens.ts (design tokens, light + dark), theme.ts, emotionCache.ts (RTL), AppThemeProvider
├── i18n/                  i18next setup, languages, format (Latin digits), locales/<lang>/<namespace>.json
├── modules/               all product functionality, one folder per module
│   ├── shared/            reusable UI: LanguageSwitcher, ThemeModeSwitcher, DemoModeNotice, BrandMark, PageHeader,
│   │                      list/form/page blocks (DataTable, ListToolbar, FormDialog, Panel…), charts/ (ECharts), hooks/, utils/
│   ├── layout/            AppLayout, Sidebar, TopBar, AppBreadcrumbs, UserMenu
│   ├── auth/              LoginPage (→ Workspace), SsoPage (/sso), ProfilePage, api/authApi (mock), handoff/ (token
│   │                      parser), mock/demoAccounts
│   ├── dashboard/         DashboardPage, access.ts (widget → permissions), api/, hooks/, mock/, types/, utils/,
│   │                      charts/ (ECharts setup + pure option builders), components/ (+ components/charts/)
│   ├── attendance/        AttendancePage (/attendance/*), paths.ts, api/, hooks/, mock/, schemas/, types/, utils/,
│   │                      charts/ (option builders), components/ (records/, shifts/, history/, reports/, common/)
│   ├── leave/             LeavePage (/leave/*), paths.ts, index.ts (profile tab), api/, hooks/, mock/ (leaveStore = data,
│   │                      leaveMock = rules), schemas/, types/, utils/ (rules, format), charts/, components/
│   ├── recruitment/       RecruitmentPage (/recruitment/*), paths.ts, api/, hooks/, mock/, schemas/, types/, utils/
│   │                      (pipeline rules), charts/, components/ (requisitions/, candidates/, pipeline/, interviews/, offers/)
│   ├── performance/       PerformancePage (/performance/*), paths.ts, index.ts (profile tab), api/, hooks/, mock/, schemas/,
│   │                      types/, utils/, charts/, components/ (cycles/, goals/, reviews/, competencies/, development/)
│   ├── employees/         EmployeesPage (/employees/*), paths.ts, api/, hooks/, mock/, schemas/, types/, utils/,
│   │                      components/ (EmployeeDirectory, EmployeeProfile + profile/, form/)
│   ├── organization/      OrganizationPage (/organization/* tabs), paths.ts, api/, hooks/, mock/, schemas/, types/,
│   │                      utils/ (hierarchy, countries, serverErrors), components/ (common/, departments/, positions/,
│   │                      locations/, hierarchy/, OverviewSection)
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

- `/login` (public, forwards to the DataHub Workspace; signed-in users are redirected), `/sso` (public; Workspace sign-in, see Authentication) → signed-in shell (`RequireAuth` + `AppLayout`): `/` redirects to
  the role's landing page (first available nav item: dashboard, or profile for Employee), `/dashboard`, `/profile`,
  `/organization/*` (sub-routes inside the module: `departments[/:id]`, `positions`, `locations[/:id]`, `hierarchy`),
  and a 404 inside the shell.
- **`core/routes/navigation.ts` is the single map** of pages: path, icon, required permissions (`anyOf`) and
  `available`. The sidebar shows the items the role may see; planned areas are listed disabled ("Soon") so roles see
  their future scope — never link them before the module exists. Breadcrumbs read `handle.navKey` set by `navRoute()`.
- **Adding a page:** set its nav item `available: true`, add `navRoute('<key>', LazyPage)` (`{ nested: true }` when the
  page owns sub-routes with `<Routes>`) in the router (it wraps the
  page in `RequirePermission`, falling back to the access-denied page), add its `nav.items.<key>` label (EN + AR).

## Authentication and roles (Phase 3 — MOCK)

- **No sign-in of its own — the DataHub Workspace is the ONLY sign-in (prototype).** Staff sign in once on the public
  website (`/workspace/login/`, with THESE demo accounts — mirrored in
  `apps/datahub-website/src/modules/portals/data/accounts.ts`; keep both lists in sync). This portal has no
  username/password form and no demo-account buttons.
  - **Entering:** the Workspace opens `/sso#token=…` — base64url JSON (`WorkspaceHandoffPayload` from
    `@datahub/shared-types`: issuer `datahub-workspace-prototype`, account email, ~2-minute expiry; no password, no
    permissions) in the URL HASH (never sent to servers). `modules/auth/SsoPage.tsx` (public, outside `RequireAuth`)
    reads it once, strips it from the URL, calls `authApi.exchangeHandoff(token)` (parser: `handoff/workspaceHandoff.ts`)
    and stores the session for that demo account, then goes to `/` (the role's landing page). A missing, malformed,
    expired (or > 5 min), wrong-issuer or unknown-account token (e.g. the Workspace's Blogs Administrator) ends any
    session in this tab and shows `/login` with a short error and a "Continue to DataHub Workspace" button.
  - **Signed out:** `RequireAuth` → `/login` (`LoginPage.tsx`), which forwards at once to the Workspace's
    `/workspace/open/hr-admin/` (sign in there if needed, then back through `/sso`). No form.
  - **Back to the Workspace:** the top bar's "DataHub Workspace" button (icon on phones; `workspaceHomeUrl`) opens the
    Workspace dashboard in the same tab — the session stays.
  - **Sign out** (user menu) clears this session and goes to the Workspace's `/workspace/logout/` (ends the central
    session → Workspace sign-in).
  - **Session check:** while signed in, `core/context/WorkspaceSessionCheck.tsx` (rendered by `AuthProvider`) embeds the
    website's hidden `/workspace-session.html`, which reports the central session by `postMessage` (only messages from
    the Workspace origin count; asked again on window focus). Signed out centrally (any tab) or another account → this
    session ends and the user goes back through the Workspace. No answer changes nothing. Loop guard
    (`core/context/workspaceEnded.ts`): two such sign-outs within 30 s → the sign-in page stops redirecting
    automatically (happens when cross-site embeds get partitioned storage — deploy both apps on the same site).
  - Workspace URL: `core/config/workspace.ts` (`VITE_WORKSPACE_URL`, dev default `http://localhost:3000`; production
    without it cannot sign anyone in — the page says so). The token is **unsigned** — a backend token (or a backend SSO
    session check) replaces only the parser, `exchangeHandoff`'s body and the session check.
  - Tests: `auth.test.tsx`, `sso.test.tsx`, `handoff/workspaceHandoff.test.ts` (`test/handoffToken.ts`; tests stub
    `window.location` for the cross-origin redirects).
- Permanent "Demo Mode — Not Real Authentication" warning (full notice on `/login`, badge in the app bar). The token is
  a random `mock-…` placeholder; no password ever reaches this portal.
- Session: `AuthProvider` keeps it in `sessionStorage` (`datahub-hr-admin.session`, ends with the tab), validates its
  shape on load, expires it after 8 h and clears the TanStack Query cache on sign-out.
- Demo accounts (fictional, `@demo.datahubhr.test`, `mock/demoAccounts.ts`): `sysadmin` (System Administrator), `hr.admin`
  (HR Administrator), `hr.manager` (HR Manager), `dept.manager` (Department Manager), `employee` (Employee),
  `recruiter` (Recruiter), `payroll` (Payroll Officer). Tests sign in with `renderApp(path, { as: role })`.
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
- **Charts (Apache ECharts):** the chart infrastructure is shared (`modules/shared/charts/`: `echarts.ts` registers only
  Line/Bar/Pie + Grid/Tooltip/Legend + the SVG renderer; `base.ts` theme/RTL helpers; `EChart`, `ChartCard`,
  `useChartContext`, `CHART_HEIGHT`). `dashboard/charts/options.ts` holds the dashboard's pure option builders (data +
  `ChartContext` {mode, direction, language} → option) using `chartColors` (light + dark, ≥ 3:1 contrast). `EChart`
  renders with `autoResize` (ResizeObserver) and `notMerge`; `ChartCard` provides loading / error + retry / empty states.
  Import the React wrapper from `echarts-for-react/esm/core` — the CommonJS `lib/core` breaks in the production bundle.
- **Charts and RTL:** ECharts never mirrors itself. The chart surface is always `dir="ltr"` (inherited RTL misplaces SVG
  text); builders mirror explicitly — category axes `inverse`, value axes on the right, legends right-aligned and
  reversed, legend text with the name last, tooltips `direction: rtl`. Numbers via `formatNumber` (Latin digits).
- **Bundle:** ECharts is a lazy chunk shared by the dashboard and attendance pages (~200 kB gzip, never preloaded by
  `index.html`) — never make it a manual chunk (the bundler then pulls shared helpers into it and every page preloads
  it). `chunkSizeWarningLimit` is 650 kB for this.
- **Tests:** `src/test/echartsStub.ts` replaces `echarts-for-react` in jsdom and records each chart's props (data,
  colours, RTL, resize). `charts/options.test.ts` renders every option with the REAL engine (ECharts SSR → SVG).
  Always also check charts in a real browser (EN/AR, light/dark): stubs cannot catch rendering or bundling bugs.

## Organization Management (`modules/organization`, Phase 5)

- **Data flow:** sections → `hooks/useOrganization.ts` (queries: summary, departments list/detail/hierarchy, positions,
  locations, manager options; mutations: create / update / status for each entity) → `api/organizationApi.ts` (the 15
  suggested functions + `getOrganizationSummary`, `getDepartmentHierarchy`, `getManagerOptions`) →
  `mock/organizationMock.ts` (in-memory stores, fictional data in `mock/seed.ts`). Keys `['organization', <resource>, …]`;
  a department change invalidates departments + positions (they show department names) + summary; positions and
  locations invalidate their own resource + summary.
- **Business rules live in the (mock) backend** and return `VALIDATION` with `fieldErrors`: unique codes per entity
  (case-insensitive, stored upper-case), no circular parents (`self` / `circular`, `utils/hierarchy.ts`), only active
  departments as new parents / position departments, no deactivating a department with active subdepartments, no
  activating under an inactive parent. Forms show them on the field (`utils/serverErrors.ts`); field format rules are
  the shared Zod schemas (`schemas/organizationSchemas.ts`), which the mock also applies to payloads.
- **Permissions (existing matrix, no new permission):** `organization:read` opens the module (System/HR Admin, HR
  Manager, Recruiter); `organization:write` shows create/edit/status/manager actions (System/HR Admin, HR Manager).
  Department Manager, Payroll Officer and Employee get access denied. The backend must enforce both.
- **Employee-backed:** department managers are employee ids; department employee counts are the active employees
  assigned to the unit (computed from employee records); `getManagerOptions` returns active employees (server-side
  search). The eight top-level departments reuse the dashboard's ids/names and the generated employees match its
  headcounts (Engineering 58 active + 4 inactive…); the dashboard's own mock is separate, so edits don't change it.
- **Public API (`index.ts`):** query keys, `useDepartmentOptions`, `usePositions`, `useLocations`,
  `useDepartmentHierarchy`, `countryName`/`LOCATION_COUNTRIES`, `orgPaths`, types — used by Employee Management.
- **UI:** generic list/form blocks live in `modules/shared` (see below); `components/common/ManagerField` is the
  department-manager picker. Deactivation is confirmed.
- **Tests:** `api/organizationApi.test.ts` (lists, rules), `utils/hierarchy.test.ts`, `schemas/*.test.ts`,
  `hooks/useOrganization.test.tsx` (keys, caching, invalidation), `organization.test.tsx` (roles, lists, forms,
  status, hierarchy, states, Arabic, dark).

## Employee Management (`modules/employees`, Phase 5)

- **Routes** (inside `EmployeesPage`, `/employees/*`): directory (index), `new`, `:employeeId` (profile; tab in the URL,
  `?tab=documents`), `:employeeId/edit`. Breadcrumbs: Home › Employees › name › Edit (`useBreadcrumbs`).
- **Data flow:** components → `hooks/useEmployees.ts` (`useEmployees`, `useEmployee`,
  `useEmploymentHistory`, `useManagerOptions`; mutations create / update / status) →
  `api/employeesApi.ts` (`getEmployees`, `getEmployeeById`, `createEmployee`, `updateEmployee`, `updateEmployeeStatus`,
  `getEmployeeEmploymentHistory`, `getManagerOptions`) →
  `mock/employeesMock.ts` (fictional, deterministic seed in `mock/seed.ts`: 248 people, `.test` e-mails, "000" phones).
  Keys `['employees', resource, scope, …]`; every employee write invalidates `employees` **and** `organization`
  (counts, manager names/options).
- **Organization integration:** department / position / location options come from the Organization API via
  `@/modules/organization` (`hooks/useAssignmentOptions.ts`) — never duplicated. New assignments only to ACTIVE
  records (saved values stay selectable); positions are those of the selected department; changing the department
  clears position and manager. The mock (like the backend) re-checks: exists, active, position ∈ department.
- **Rules (backend, `VALIDATION` + `fieldErrors`):** unique employee number and work e-mail (case-insensitive);
  manager must be active, not the employee, not someone reporting to them, and in the employee's department or a
  parent department; no deactivating a department manager or someone with active direct reports; no activating with
  an inactive assignment. Form-level rules (formats, dates: age ≥ 16 at hire, contract start ≥ hire, end after start
  and required for contract/temporary/intern, probation within a year) are the shared Zod schema
  (`schemas/employeeSchemas.ts`), applied by the mock too. Department/position/manager/status changes are added to
  the employment history automatically.
- **Permissions / scope (existing matrix):** `employees:read` → whole organization (System/HR Admin, HR Manager,
  Payroll Officer — read-only); `employees:read:team` → Department Manager, own team only (departments they manage +
  subdepartments; the mock maps demo accounts to employees and returns `FORBIDDEN` outside the team);
  `employees:write` → create/edit/status; the Documents tab is Documents Management's (see below);
  `employees:read:personal` (System Admin, HR Admin, HR Manager only) → personal details, see below.
  Recruiter and Employee have no access. `useEmployeeAccess` derives the scope from the session; the real backend
  must derive it from the token, never from the request.
- **Personal information (`employees:read:personal`):** date of birth, gender, nationality, marital status, personal
  e-mail, phones, address (incl. city/country) and emergency contact form the profile's `personal` block, which the
  API returns as `null` without the permission (enforced in the mock from the viewer's role — the real backend must
  decide from the token). (Identity and medical documents follow the same rule in Documents Management: highly confidential.) The UI
  shows a "restricted" notice and no Emergency tab; employment and organization data stay visible. Payroll Officers
  and Department Managers keep their read access (organization / own team) without personal details. Editing needs
  the personal block (`employeeToInput` throws without it); every role with `employees:write` holds the permission.
- **Documents:** the profile's Documents tab is `EmployeeDocumentsTab` from `@/modules/documents` (lazy). Employee
  Management keeps NO document store of its own (one source of truth: Documents Management).
- **Tests:** `mock/employeesBackend.test.ts` (seed consistency with Organization, directory, scoping, rules, status,
  history, manager options), `schemas/employeeSchemas.test.ts`, `hooks/useEmployees.test.tsx` (scoped
  keys, cross-module invalidation), `employees.test.tsx` (roles, directory, create/edit, status, profile, documents,
  history, states, Arabic, dark).

## Attendance Management (`modules/attendance`, Phase 5)

- **Routes** (inside `AttendancePage`, `/attendance/*`): overview (index), `records`, `records/:recordId`, `shifts`,
  `shifts/:shiftId`, `history`, `history/:employeeId?month=YYYY-MM`, `reports`. Own-only roles see "My attendance"
  (their history; the API resolves `employeeId = 'me'` from the signed-in account) and are redirected from the rest.
- **Data flow:** components → `hooks/useAttendance.ts` (keys `['attendance', resource, scope, …]`; every write
  invalidates `['attendance']`) → `api/attendanceApi.ts` (summary, records, record, history, create/update record,
  checkIn/checkOut, shifts CRUD + status + members + assign, reports, CSV export) → `mock/attendanceMock.ts`.
- **One dataset:** records are generated for the EXISTING employees (Employee Management ids, via `employeeRecords`)
  from a deterministic hash of employee id + date over the current month and the three before (`WINDOW_MONTHS`), only
  for days the employee was employed (deactivated employees keep their earlier records) and their shift works. The
  overview, records, history, reports and CSV all read the same records. Each record keeps a SNAPSHOT of the employee's
  department/position and of the shift on that day; shift assignments have an effective date.
- **Status rules** (`utils/time.ts`, pure, tested): computed from the shift window, punches and "now" — `scheduled`
  ("Not started") until the shift ends without a check-in (never "absent" just because a check-in is missing),
  `absent` after it, `late` after start + grace (late minutes count from the start), `half-day` under half the
  scheduled working time, `incomplete` when the check-out is still missing 4 h after the shift end, `on-leave`.
  Overnight shifts end the next day. Worked time deducts the break.
- **Simulated operations:** check-in/out are labelled simulated; the backend refuses a second check-in/out, a check-out
  before the check-in, future times and times far from the shift; manual records only for days without one.
- **Permissions (existing matrix):** `attendance:read` → organization; `attendance:read:team` → Department Manager's
  departments (+ subdepartments; records by their snapshot department); `attendance:read:own` (every role's
  self-service) → own records only; `attendance:write` → records, punches, shifts, assignments. The mock enforces all
  of it from the scope's role (`FORBIDDEN`). Gaps reported, not implemented: Payroll Officer has no organization-wide
  attendance read; no permission lets employees check themselves in.
- **CSV export:** `exportAttendanceReport` returns the whole filtered report (scope applied) in the UI language, with a
  BOM and spreadsheet-formula neutralisation (`csvCell`); the page downloads it as a Blob. No extra dependency.
- **Tests:** `utils/time.test.ts`, `mock/attendanceBackend.test.ts` (fixed clock: consistency, determinism, history,
  punches, shifts, reports/CSV, every role), `attendance.test.tsx` (UI on a fixed clock: overview/charts, records,
  punches, shifts, history, reports export, roles, states, Arabic, dark). Use `vi.useFakeTimers({ toFake: ['Date'] })`
  for "now".

## Leave Management (`modules/leave`, Phase 5)

- **Routes** (inside `LeavePage`, `/leave/*`): overview (index), `requests`, `requests/:requestId`, `approvals`
  ("Awaiting me"), `my`, `balances`, `balances/:employeeId?year=`, `calendar`, `reports`, `types`, `types/:typeId`.
  Own-only roles get "My leave" at the index (balances + own requests; the API resolves `employeeId = 'me'`) and are
  redirected from the rest.
- **Data flow:** components → `hooks/useLeave.ts` (keys `['leave', resource, scope, …]`; request writes invalidate
  `['leave']` AND `['attendance']`, type writes only `['leave']`) → `api/leaveApi.ts` (the 19 requested functions +
  `getLeaveQuote`) → `mock/leaveMock.ts` (rules) → `mock/leaveStore.ts` (data). Every rule is enforced in the mock
  (`VALIDATION` + fieldErrors, `CONFLICT` for state changes, `FORBIDDEN` outside scope); `request.can` tells the UI which
  actions to offer.
- **Rules:** days = working days of the employee's shift schedule (Attendance) minus public holidays when the type excludes
  them; one calendar year per request; no overlap with pending/approved leave; no days already worked (check-in);
  inactive employees / inactive or ineligible types refused; document and balance checked on submission. Balance:
  **remaining = allocated − used − pending** (pending reserves, approval uses, rejection/cancellation releases, cancelling
  approved leave restores). Allocation per type (base, seniority bonus, first-year pro-rating) — configurable EXAMPLES,
  not an official policy. Balance history = ledger of each request (sum = remaining, tested).
- **Approval:** `leave:approve` (organization) or `leave:approve:team` (the manager's departments); never one's own
  request; only pending ones (no double decision, rejected/cancelled can't be approved); rejection needs a reason.
  Employees cancel drafts/pending and approved leave before it starts; approvers cancel any approved leave.
- **Attendance integration (one source of truth):** Attendance never stores leave. `toRecord` looks up
  `leaveData.approvedOn(employee, date)` on every read (`onLeave` + `leaveRequestId`), generation skips punches on approved
  leave days, check-ins on leave days are refused, and the record's manual "on leave" flag is gone. Cancelling approved
  leave makes the days working days again (past ones without a check-in → absent). "On leave today" is the same figure in
  both overviews (tested). Layering avoids an import cycle: `leaveMock → attendanceMock → leaveStore` (lint-enforced:
  `leaveStore` may import only the attendance *seed*).
- **Permissions (existing matrix):** `leave:read` (System/HR Admin, HR Manager) organization; `leave:read:team`
  (Department Manager) team + own; `leave:read:own` everyone; `leave:request` own requests only;
  `leave:manage-policies` (System/HR Admin) leave types. Reasons and documents are returned only to the requester and to whoever may decide the request; drafts only
  to their owner; gender-restricted types appear in other people's balances only when used. Gaps (reported, not
  implemented): no `leave:request` on behalf of others; Payroll Officer has no organization-wide leave read.
- **UI:** request form (RHF + Zod) with a live balance summary from the API; calendar built from MUI (month grid, agenda
  list on phones, no new dependency); Employee Profile "Leave" tab (lazy-loaded `EmployeeLeaveTab` from `@/modules/leave`).
  Leave never imports Employees or Attendance (links via the navigation map) — module graph: employees → leave → organization.
- **Tests:** `utils/rules.test.ts`, `mock/leaveBackend.test.ts` (seed, every rule, scope, balances, workflow, attendance
  integration, calendar, reports/CSV), `charts/options.test.ts` (real ECharts SSR), `hooks/useLeave.test.tsx`,
  `leave.test.tsx`.

## Recruitment Management (`modules/recruitment`, Phase 5)

- **Routes** (`/recruitment/*`): overview, `requisitions[/:id]`, `candidates[/:id]` (tabs profile / timeline / interviews /
  offers), `candidates/:id/convert` (lazy), `pipeline` (board or `?view=list`, `?requisition=`), `interviews[/:id]`,
  `offers[/:id]`.
- **Data flow:** components → `hooks/useRecruitment.ts` (keys `['recruitment', resource, scope, …]`; every write
  invalidates `['recruitment']`; conversion also `employeeKeys.all` + `organizationKeys.all`) → `api/recruitmentApi.ts` →
  `mock/recruitmentMock.ts` (one in-memory dataset generated relative to today; departments / positions / locations are
  Organization ids, people are Employee ids — no copied data).
- **Workflows (enforced in the mock):** requisition statuses draft → pending approval → open ⇄ on hold → closed (reopen) /
  cancelled; candidate pipeline `utils/pipeline.ts` (valid transitions only, every change in the history; **hired only
  through an accepted offer**; hired/rejected final, explicit reopen of rejected); one active application per e-mail;
  interviews: future times, no double booking of interviewers/candidate, cancel with reason, feedback once per assigned
  interviewer after the interview (1–5 + recommendation); offers: draft → sent (simulated) → accepted / rejected /
  withdrawn, expired automatically, salary within the requisition range, one active offer per candidate, accepting
  closes a filled requisition. Nothing is e-mailed, published or sent — labelled as simulated.
- **Candidate → employee:** `candidates/:id/convert` renders Employee Management's own `EmployeeForm` (exported from
  `@/modules/employees` with an `external` create flow), pre-filled from the candidate + accepted offer; the mock calls the
  employees mock's `createEmployee` (same validation and employee-number rules), links `candidate.employeeId` and records
  the history. Refused twice (`CONFLICT`); needs `recruitment:write` + `employees:write` (not the Recruiter).
- **Permissions:** `recruitment:read`/`write` (HR roles, Recruiter); `recruitment:read:team` (Department Manager, approved
  addition): requisitions of their departments / where they are the hiring manager, read-only, no salaries or offers,
  may submit their own interview feedback. Private feedback: writers see all, a team interviewer only their own.
- **Tests:** `mock/recruitmentBackend.test.ts`, `charts/options.test.ts`, `hooks/useRecruitment.test.tsx`,
  `recruitment.test.tsx`.

## Performance Management (`modules/performance`, Phase 5)

- **Routes** (`/performance/*`): overview, `my`, `reviews[/:id]`, `goals`, `cycles[/:id]`, `development[/:id]`,
  `competencies`. Own-only roles get "My performance" at the index and are redirected from the rest.
- **Data flow:** components → `hooks/usePerformance.ts` (keys `['performance', resource, scope, …]`; every write
  invalidates `['performance']`) → `api/performanceApi.ts` → `mock/performanceMock.ts` (cycles, reviews, goals, plans,
  competencies, templates and the rating scale in one dataset; participants are existing employees).
- **Rules (mock):** cycle dates in order, no overlapping review periods; draft → active (creates every participant's
  review) → in progress / completed (automatic) → closed (final, history kept); goals 0–100 %, "completed" = 100 %,
  final statuses locked, history recorded, goals in a cycle join that cycle's review; self-assessment only by the
  employee, final once submitted unless HR reopens it; manager review by `performance:write` or `performance:review:team`
  (team), never one's own, after the self-assessment or its deadline; ratings must be on the configured scale (values
  1–5 fixed, labels configurable — examples, not policy); templates used by an open cycle are locked; plans complete only
  when every activity is done. Drafts of the other party are never shown (manager sees submitted self-assessments only;
  the employee sees the manager review once submitted).
- **Permissions (approved additions):** `performance:read:own` (every role), `performance:read:team` +
  `performance:review:team` (Department Manager), `performance:manage-config` (HR Admin; System Admin has all). HR Manager
  keeps organization-wide `performance:read`/`write` without configuration.
- **Employee Profile:** lazy "Performance" tab (`EmployeePerformanceTab` from `@/modules/performance`) for organization /
  team readers.
- **Tests:** `mock/performanceBackend.test.ts`, `charts/options.test.ts`, `hooks/usePerformance.test.tsx`,
  `performance.test.tsx`.

## Payroll Management (`modules/payroll`, Phase 5)

- **Routes** (`/payroll/*`): overview, `runs[/:id[/employees/:employeeId]]`, `compensation[/:employeeId]`, `structures`,
  `allowances`, `deductions` (+ calculation policy), `payslips[/:id]`, `reports`, `my`. Roles without `payroll:read` get
  "My payroll" at the index; only `payslips/:id` stays reachable (the API returns NOT_FOUND for others' payslips).
- **Data flow:** components → `hooks/usePayroll.ts` (keys `['payroll', resource, scope, …]`; every write invalidates
  `['payroll']`) → `api/payrollApi.ts` → `mock/payrollMock.ts`. Salaries live ONLY in payroll (never in employee
  listings); employees/organization are read through their mocks, attendance through `attendanceFacts` and approved
  leave through `leaveFacts` (read-only backend accessors added to those mocks).
- **Money (`utils/money.ts`):** integers in minor units (JOD 3 decimals, USD/SAR/AED 2), basis points for percentages,
  exact `divRound` half-up; one rounding per line, totals = sums of rounded lines; forms parse decimal text (never
  floats); display formats the decimal string. No currency mixing (summary and reports use JOD, the demo currency).
- **Engine (`utils/engine.ts`, pure, tested):** basic prorated per compensation segment by calendar days; recurring
  items in full while in force, one-time in their period; overtime always 0 (no attendance field — reported gap);
  unpaid leave = APPROVED unpaid leave days (each once) × basic ÷ divisor (policy, default 30); absence only when an
  absence deduction type is active; lateness never; statutory types illustrative and inactive by default; caps per
  period; negative net = error. Each line stores a snapshot of its inputs; validation warns if inputs changed.
- **Rules (mock):** compensation records immutable (ends derived from the next record), no back-dating before the
  latest record or into approved/paid periods; one active type per system deduction cause; runs = one calendar month,
  no overlapping non-cancelled runs over the same employees; draft → calculated → validated → pending approval →
  approved → paid (simulated) — rejected runs recalculated or edited (→ draft) and resubmitted; paid/approved final;
  creators never approve/reject their own run; payslips only from approved/paid runs; every transition in history.
- **Permissions (approved additions):** `payroll:read:own` (every role), `payroll:approve` (HR Admin; System Admin
  has all). Payroll Officer processes (`payroll:write`) but never approves; HR Manager reads only.
- **Payslip PDF:** `PayslipDocument` (inline-styled, bilingual) is shown on screen and rendered to static markup
  (`react-dom/server`, lazy chunk — excluded from the `react` manual chunk) into a hidden frame → browser print
  ("Save as PDF"). No PDF library.
- **Tests:** `utils/engine.test.ts`, `mock/payrollBackend.test.ts`, `charts/options.test.ts`, `payroll.test.tsx`.

## Documents Management (`modules/documents`, Phase 5)

- **Routes** (`/documents/*`): overview, `directory[/:documentId]` (`?search=` / `?status=` pre-filter it), `expiry`,
  `required`, `categories`, `my`. Roles reading only their own documents get "My documents" at the index.
- **One source of truth:** `mock/documentsMock.ts` holds every document record — employee documents (Employee
  Management no longer stores any), candidate documents (owner = candidate; categories marked `transferOnHire` are
  LINKED to the employee once the candidate is hired, no copy), leave attachments (registered once from Leave requests,
  same file reference) and payroll supporting documents. Payslips stay in Payroll and are only referenced (links).
  Read-only accessors used: `employeeRecords`, `orgTables`, `candidateRecords` (recruitment mock), `leaveData`,
  `payslipRecords` (payroll mock). UI integration: `EmployeeDocumentsTab` (profile), `CandidateDocumentsPanel`
  (candidate profile, `recruitment:read`), `PayrollDocumentsPanel` (compensation page) — all lazy imports of
  `@/modules/documents`; Leave links to the directory by request number. Documents imports none of those UIs.
- **Data flow:** components → `hooks/useDocuments.ts` (keys `['documents', resource, scope]`, scope = user + role;
  every write invalidates `['documents']`) → `api/documentsApi.ts` → mock.
- **Files are SIMULATED:** the browser sends file names and sizes only; nothing is stored; `downloadAvailable` is
  always false and no download link exists anywhere. Future backend contract: authenticated upload, scanning, encrypted
  storage, per-request authorised short-lived downloads, audit (documented on `FileRef`).
- **Rules (mock):** category-driven validation (file types, size, max 5 files, expiry required, unique number),
  issue ≤ today ≤ … expiry ≥ issue, owner active and eligible (owner type, employment type). Verification status
  (pending / verified / rejected / archived / superseded) is separate from expiry (valid / expiring soon (threshold,
  initially 30 days, configurable) / expired / no expiry); overall status `expired` overrides pending/verified.
  Expired, archived or superseded documents cannot be verified; reject and archive need a reason; editing number,
  dates or category returns a verified document to review; a replacement supersedes the previous document only when
  verified (both kept and linked); nothing is deleted; every decision is in the history.
- **Required documents:** rules (any of N categories × employment types × status × department) → per-employee
  checklist (required within a 30-day grace period, missing, uploaded-with-replacement-requested, pending
  verification, verified, expired) and completeness. Information only: never blocks payroll or changes status.
- **Permissions (approved additions):** `documents:read:own` (every role), `documents:read:team` (Department
  Manager: team, standard confidentiality, manager-visible categories), `documents:manage-config` (HR Admin).
  Payroll roles see payroll categories (`payroll:read`), recruitment roles candidate documents (`recruitment:read`;
  `recruitment:write` uploads/reviews them). Highly confidential documents also need `employees:read:personal`;
  internal notes are never returned to owners, managers or payroll. Anything not visible → NOT_FOUND.
- **Tests:** `mock/documentsBackend.test.ts`, `charts/options.test.ts`, `documents.test.tsx` (+ the profile tab in
  `employees.test.tsx`).

## Shared building blocks (`modules/shared`)

- Lists: `DataTable` (server-side sort/pagination, loading / error + retry / empty, `hideBelow` per column),
  `ListToolbar` + `FilterSelect`, `RowActions`, `StatusChip`; `hooks/useListState` (1-based params, 300 ms search
  debounce, optional initial search/filters — e.g. from the URL — so the first request is already filtered). Forms: `FormDialog` (optional `secondaryAction`, `maxWidth`), `SelectField` (RHF-bound select),
  `ConfirmDialog`, `formFields` (`textFieldProps`, `arabicInput`/`latinInput`), `utils/download` (CSV via Blob),
  `utils/serverErrors` (`applyServerErrors`). Pages: `Panel`, `DetailList`, `QueryBoundary`, `Feedback` +
  `hooks/useFeedback`, `hooks/useStatusFlow` (confirmed deactivation). Texts come from `common` (`list.*`, `status.*`).
- Modules translate their own field/server reasons (`utils/serverErrors.ts` per module) and wrap `useStatusFlow` with
  their wording.
- **Gotcha:** in MUI `sx` a number ≤ 1 is a fraction (`width: 1` = 100%) — use `'1px'` for visually-hidden styles.

## Simulated backend across modules

Organization, Employees, Attendance, Leave, Recruitment, Performance, Payroll and Documents mocks are ONE simulated backend: their `mock/`
folders may import each other's `mock/` files (organization ⇄ employees; attendance → employees + organization + leave
`leaveStore` only; leave → attendance + employees + organization; recruitment → employees + organization; performance →
employees + organization; payroll → employees + organization + attendance + leave mocks; documents → employees + organization + recruitment +
leave + payroll mocks) and nothing else of the other module — lint overrides allow exactly that. Never import
another module's mock from UI, hooks or API code. `test/setup.ts` resets every mock after each test.

## Security (even with mock data)

- No real employee data, no real personal data — fictional seeds only.
- No passwords stored in plain text (or at all) in mock auth; mock tokens are clearly mock.
- `VITE_*` variables are public: never put secrets or API keys in them (or anywhere in this frontend).
- Never present client-side checks or mock auth as production-ready security.

## Relationship with other workspaces

- Never import website or DataHubHR code (lint-enforced); never share UI with React Native.
- `@datahub/shared-types` only for contracts both frontends genuinely consume (today: `Locale`, `Direction` and the Workspace handoff token `WorkspaceHandoffPayload`).
  The API types written here are drafts of the future shared contract; promote one only when the mobile app uses it.
