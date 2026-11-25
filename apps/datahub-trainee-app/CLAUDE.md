# CLAUDE.md — DataHub Trainee App (apps/datahub-trainee-app)

Training management web app: a modern replacement of the original **Datahub Training Portal** (.NET + React). The business
functionality, roles and rules of the original are preserved ([docs/PARITY.md](docs/PARITY.md) is the checklist and
lists every intentional deviation); the old UI is not reused.

- **Sign-in is the DataHub Workspace only.** No login form, no passwords, no credentials of its own.
- **Data comes from the DataHub Analytics API** (`/api/v1/academy/…`, users, roles, organization departments) with the
  Workspace access token. A simulated backend (fictional data, `localStorage`) stays available as a switch — see "Data source".

## Commands (from the monorepo root)

| Command | Purpose |
| --- | --- |
| `npm run dev:trainee` | Vite dev server → <http://localhost:3002> (open it through the Workspace) |
| `npm run build:trainee` | `tsc -b` + production build |
| `npm run lint:trainee` | oxlint, including architecture boundaries |
| `npm run test:trainee` | Vitest (jsdom + Testing Library) |

Before finishing a change: `npm run typecheck && npm run lint:trainee && npm run test:trainee && npm run build:trainee`.

## Architecture (same philosophy as the website: `core` · `i18n` · `modules`)

```
src/
├── core/                    infrastructure — never imports modules (except routes/index.tsx, the router)
│   ├── api/                 types.ts (ListParams, Paginated, ApiError{code,reason}), queryClient, mock/ (the simulated backend toolkit)
│   ├── auth/                Workspace session: handoff parser, AuthProvider, session check (iframe bridge), loop guard,
│   │                        trainingPolicy.ts (business roles → permissions), workspaceAccess.ts, actor.ts
│   ├── config/              workspace.ts (URLs), evaluationDefaults.ts (original scoring constants)
│   ├── domain/              the roles/statuses vocabulary of the original portal (shared by UI, policy and backend)
│   ├── guards/              RequireAuth, RequirePermission (UI only)
│   ├── hooks/               breadcrumbs, useActorKey
│   ├── routes/              index.tsx (router), paths.ts (ROUTES), navigation.ts (THE page map)
│   ├── theme/               tokens.ts, theme.ts (light), RTL Emotion cache, AppThemeProvider
│   └── utils/               pure business rules: scoring.ts, enrollmentRules.ts, assignmentStatus.ts
├── i18n/                    typed en.json / ar.json (`UiStrings`), LocaleProvider, format.ts (dates/numbers, Latin digits)
└── modules/
    ├── shared/              DataTable, FormDialog, ConfirmDialog, StatusChip, StatCard, … (never imports other modules)
    ├── layout/ auth/ errors/ dashboard/ trainings/ enrollments/ users/ departments/ rankings/ evaluations/ certificates/
```

A module owns `api/` (the ONLY data entry point) · `mock/` (its simulated backend) · `hooks/` (TanStack Query) · `schemas/`
(Zod, built from the translations) · `types/` · `components/` · `XPage.tsx` (lazy-loaded default export). Layers are
enforced by `.oxlintrc.json` (generated per module): UI/hooks/schemas never import `mock/`; mocks use only core and their
own module; modules reach each other only through `index.ts`; nothing imports another app, React Native or Expo.

```
Component → useTrainings() → trainingsApi.list() → trainingsMock → core/api/mock/mockDatabase
```

Each `modules/*/api/<x>Api.ts` exports ONE object typed by the simulated implementation; it is the real HTTP implementation
(`<x>Http.ts`) or the simulated one, chosen by `DATA_SOURCE` — hooks and components never know which runs.

## Two separate authorization layers (never mix them)

1. **Workspace access** — may this signed-in Workspace user open the app? `core/auth/workspaceAccess.ts` +
   the website's launcher (`apps/datahub-website/.../portals/data/applications.ts`) opens it only when the backend lists
   `academy-admin` (this app's portal key, `WORKSPACE_APP_ID`). In the app itself: a `training.*` permission, or **INTERIM:
   any staff user with a backend role** (the app cannot call `/portals`: the API's CORS list lacks its origins — replace
   the interim line with a portals check once it does).
2. **Training business roles** — what can the user do inside the app? `SuperAdmin`, `DepartmentAdmin`, `Trainee`, `Employee`,
   `Intern` (original names; learners are identical in the original). `core/auth/trainingPolicy.ts` is the single table;
   guards, navigation and every mock handler use it. DepartmentAdmin is limited to their own department.

The business identity is a record of the **simulated training directory**, matched to the Workspace user by e-mail (created on
first sign-in: Workspace `system-admin` → SuperAdmin, everyone else → Employee). A business role never grants any Workspace
permission and the Users module never touches Workspace accounts. The user menu's **"View as another user"** (mock only)
switches the business identity for testing — it never changes the session, token or Workspace permissions.

## Workspace SSO (adapted from the HR Admin Portal's proven flow)

`/sso#token=…` (base64url `WorkspaceHandoffPayload`: issuer, e-mail, ~2 min link expiry, backend access token) → parsed once,
hash stripped, JWT claims decoded (not verified — the backend does) → session in this tab's `sessionStorage`
(`datahub-trainee.session`), ends at token expiry. Signed-out → `/login` (only a "redirecting" status, no page) → Workspace `/workspace/open/academy-admin/`; the page asked
for is kept in this tab (`core/auth/returnTo.ts`) and `/sso` returns there instead of the landing page. Material links
render only `http(s)` addresses (`core/utils/safeUrl.ts`) — an empty `href` would reopen this app in a new tab.
Sign out → Workspace `/workspace/logout/`. `/activate?token=…` (public; invitation e-mails built with this app's origin)
forwards unchanged to the website's activation page `<VITE_WORKSPACE_URL>/activate/?token=…` — activation is the website's. While signed in, the hidden `/workspace-session.html` (embedded iframe) reports the
central session; ended or another account → this session ends (loop guard after two endings in 30 s). Tokens are never logged
or put in `localStorage`. `VITE_WORKSPACE_URL` (dev default `http://localhost:3000`). The website needs `VITE_TRAINEE_APP_URL`
(dev default `http://localhost:3002`). Production values live in the git-ignored `.env.production` of each app; this app is
deployed to Azure App Service (Windows/IIS) by uploading `dist/` (`public/web.config` = SPA fallback).

## Data source — real API (`*Http.ts`) or simulated backend

- `core/config/api.ts`: `DATA_SOURCE` = `api` (default) or `mock` (tests always; or `VITE_TRAINEE_DATA=mock`). `API_BASE_URL` =
  `VITE_API_URL` in production (the deployed origin must be in the API's CORS list — as of 2026-11-24 it is NOT); in
  development requests stay on the dev origin and `vite.config.ts` proxies `/api` to `VITE_API_URL` (`.env.development`).
- `core/api/http.ts` is the ONE HTTP client: Bearer token (read from this tab's session), envelope `{ success, data, error }`
  unwrapped, failures → `ApiError` (`reason` = backend error code), multipart uploads (`file` part), 401 → sign-out.
- Swagger documents request bodies but NO response models (2026-11-24): every `*Http.ts` mapper reads fields through
  `core/api/read.ts` (tolerant, several likely names). When real responses differ, fix the mapper only. Statuses:
  `core/api/academyStatus.ts`. Lists the backend does not page/filter are searched / sorted / paged by `core/api/listing.ts`.
- Files (materials, assignment attachments, submissions): `trainings/components/FileList` (type icon, name = open, Download,
  optional edit/remove) → `hooks/useFileOpener` → `filesApi.download(kind, id)` → `http.download` (Bearer; GET
  `material-files` / `assignment-attachments` / `submission-attachments/{id}`; bytes, or JSON with a link / base64 —
  Swagger documents no body). PDF/images/text/video open in a tab opened during the click; other types are saved under
  their name (`utils/openFile.ts`). The simulated backend has no bytes → `file.simulated` message.
- Identity with the real API: `core/auth/apiIdentity.ts` maps the token's `academy.*` / `training.*` / `identity.*` /
  `organization.*` permissions to the app's permissions and derives the role (system-admin → SuperAdmin, managers →
  DepartmentAdmin without a known department, else Employee). "View as" exists only with the simulated backend.
- Not in the backend (2026-11-24): training start/end dates and trainer, renaming one file of a material ("not supported"),
  per-department user/training counts, dashboard filters (hidden with the real API). Live: `/academy/trainings` answers
  500 and `/academy/certificates` 403 (backend issues).

## Simulated backend (mock)

`core/api/mock/`: `mockRequest` (latency, injected failures `failNextRequest`, deep clone, abortable), `queryCollection`
(search → filter → sort → 1-based pagination), `mockDatabase` (in-memory + `localStorage` key `datahub-trainee.mock-db`,
**schema versioned**; corrupted/outdated/wrong-shape data is discarded and re-seeded; never stores credentials),
`seedData` (fictional, dates relative to now), `access.ts` (FORBIDDEN/department helpers). Handlers throw `ApiError(code,
reason, fieldErrors)`; the UI translates `reason` ids (`apiReasons.*`) — the mock holds no user-facing text. Writes
invalidate the related TanStack Query keys; every query key carries the training identity (`useActorKey`).
Files are simulated (name/type/size validated: ≤ 100 MB, original extension list; no bytes, no download).

## UI conventions

**DataHub admin design language (violet, 2026-11-24) — this app is its SOURCE.** The HR Admin Portal's `core/theme/theme.ts` is a
verbatim copy of this one and Blogs Admin's `adminTheme.ts` a standalone conversion; mirror every token / theme / shell change in both. `core/theme/tokens.ts`
(violet primary `#7c3aed`, soft canvas, card radius 14, categorical `chart` colours) + `theme.ts` (pill chips, uppercase table
headers, 3px tab indicator, rounded progress bars, flat cards). Shell (`modules/layout`): a FULL-WIDTH top bar above the
sidebar — breadcrumbs "app name › sidebar group › page", Workspace (outlined), the managers' primary action "Assign training"
(`/enrollments?assign=1` opens the dialog), notifications, language, avatar; a compact light sticky sidebar (240px) with a text wordmark,
uppercase group labels and text-only 14px items (icons only in the collapsed rail; no account block). Dashboard: big title,
filters on the right (Department — SuperAdmin; Period — enrollments assigned in the last 30/90/365 days; both in the URL and
applied by the mock), tabs Overview / Upcoming deadlines / Recent activity (`?tab=`); the overview's table sits on the canvas. KPI cards (`shared/StatCard`): label, large
number, coloured supporting line (`tone`, `emphasis` for figures needing action). Status chips are tonal pills. Inspired by
general learning-dashboard UX patterns only — never copy a vendor's branding, names or exact screens. Light only. The printed certificate keeps the DataHub
brand blue on purpose. MUI v9: **`Stack`/`Grid`
no longer accept system props** (`alignItems`, `justifyContent`, `flexWrap` → `sx`). RTL via `stylis-plugin-rtl`: write
physical `left/right`; icons that point must flip with `theme.direction`. Every string is in `i18n/locales/{en,ar}.json`
(`tsc` fails if keys differ; a test checks identical keys and placeholders). Dates/numbers via `i18n/format.ts` (Latin digits).
Every data view has loading / empty / error states; destructive actions are confirmed. Print: the certificate page uses
`@media print` (A4 landscape) and hides the shell.

## Tests

Backend rules per module (`modules/*/mock/*.test.ts`), auth/SSO/session/logout (`modules/auth/auth.test.tsx`, `core/auth/*.test.ts`),
permissions and routes (`test/ui.access.test.tsx`), full UI workflows (`test/ui.workflows.test.tsx`, `test/ui.features.test.tsx`),
persistence and mock toolkit (`core/api/mock/mockInfrastructure.test.ts`), i18n parity (`i18n/i18n.test.ts`).
`test/renderApp.tsx` renders the real app signed in as any seeded user; `test/actors.ts` sets the caller for backend tests.
