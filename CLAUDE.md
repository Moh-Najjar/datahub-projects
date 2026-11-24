# CLAUDE.md — DataHubProjects monorepo

npm-workspaces monorepo for Datahub Analytics frontends: two independent apps and one types-only package.
Read the app-level `CLAUDE.md` before working inside an app — it contains that app's own (stricter) rules.

## Architecture

| Workspace | Path | Purpose | Its rules |
| --- | --- | --- | --- |
| DataHub Website | `apps/datahub-website/` | Faithful recreation of datahubanalytics.com (EN/AR, RTL). Recreation, **not** a redesign. | [apps/datahub-website/CLAUDE.md](apps/datahub-website/CLAUDE.md) |
| DataHubHR | `apps/datahub-hr/` | HR management mobile app. Original DataHubHR branding — inspired by ZenHR's functionality only, never its branding, logos, assets or exact screens. | [apps/datahub-hr/CLAUDE.md](apps/datahub-hr/CLAUDE.md) |
| DataHub HR Admin Portal | `apps/datahub-hr-admin-portal/` | Admin web app for DataHubHR (React + MUI, EN/AR, RTL). Original product — never copies other HR vendors' code, branding, text or exact screens. Mock backend until the shared HR backend exists. | [apps/datahub-hr-admin-portal/CLAUDE.md](apps/datahub-hr-admin-portal/CLAUDE.md) |
| DataHub Trainee App | `apps/datahub-trainee-app/` | Training management web app (React + MUI, EN/AR, RTL), a modern replacement of the original Training Portal. Original product, never reuses the old UI. Signs in only through the Workspace; mock training API until a backend exists. | [apps/datahub-trainee-app/CLAUDE.md](apps/datahub-trainee-app/CLAUDE.md) |
| Shared types | `packages/shared-types/` | `@datahub/shared-types`: TypeScript types used by **both** apps. | this file |

Each app owns its source, UI, routing, styling, i18n, services, utilities, constants and configuration —
all inside its own folder. There is deliberately **no** shared runtime package.

## Application boundaries (enforced by lint)

- Website must not import React Native, Expo or DataHubHR code (oxlint `no-restricted-imports`).
- DataHubHR must not import MUI, Emotion, React DOM, React Router or website code (ESLint).
- Admin Portal must not import React Native, Expo, website or DataHubHR code (oxlint `no-restricted-imports`).
- Trainee App must not import React Native, Expo, website, DataHubHR or Admin Portal code (oxlint `no-restricted-imports`); inside it, UI/hooks/schemas never import mock data and modules talk only through `index.ts`.
- shared-types must not import React, React DOM, React Native, Expo, MUI or app code (oxlint).
- **Central staff sign-in:** the website's Workspace (`/workspace/login/`) is the ONLY sign-in, verified by the backend
  (`POST /api/v1/auth/login`; no demo accounts). Blogs Admin (`/admin/`) uses that session's access token; the HR Admin
  Portal and the Trainee App have no sign-in form — it receives the access token in a short-lived handoff at `/sso`, reads the user, role and
  permissions (backend names, e.g. `hr.leave.approve.team`) from it, and follows the central session through the
  website's hidden `/workspace-session.html` (contracts: `WorkspaceHandoffPayload`, `WorkspaceSessionStatus` in
  shared-types). Every Sign out goes to `/workspace/logout/`. HR data is still simulated — see both apps' CLAUDE.md.
- **One admin design language (violet, since 2026-11-24):** the HR Admin Portal, the Trainee App and Blogs Admin share the same tokens, theme and shell (light only): violet accent, full-width top bar above a compact sidebar (text wordmark, uppercase group labels, text-only items, 14px), flat cards, large-number KPI cards, tonal pill chips, uppercase table headers. The Trainee App's `core/theme` is the source the others were generated from. Apps never import each other, so these are intentional copies — when you change tokens, theme or shell conventions in one, mirror the change in the other two (see each app's CLAUDE.md).
- **Stay in scope:** when working on one app, do not modify the other. A change to shared-types must keep both
  apps building: run `npm run typecheck` afterwards.

## shared-types rules

1. Types only (`export type` / interfaces). No runtime code, no dependencies, no UI.
2. Add a type only when **both** apps use it; app-specific types stay in the app. Don't move types "just in case".
3. No `enum`/`namespace` (the website compiles the source with `erasableSyntaxOnly`).
4. Export everything from `src/index.ts`; group by domain folder (`src/common/`, later e.g. `src/user/`) only
   when there is real content.
5. Apps depend on it with `"@datahub/shared-types": "*"` (linked locally by npm workspaces; `private`).

## Technology restrictions

- **Website:** React + TypeScript + Vite + **Material UI** (Emotion, RTL via `stylis-plugin-rtl`), React Router,
  Framer Motion, React Hook Form + Zod. No Tailwind/Bootstrap/other UI kits. Keep `stylis` at 4.2.0.
- **DataHubHR:** Expo SDK 58 + React Native + TypeScript + **Expo Router** (routes in `src/app/`).
  Install libraries with `npx expo install` from `apps/datahub-hr`. No web UI libraries, MUI or React DOM.
  HR features are not specified yet — don't add screens, mock data or business logic speculatively.
- **Trainee App:** React + TypeScript (TS 6) + Vite + **Material UI**, React Router, TanStack Query, React Hook Form + Zod, Framer Motion (subtle), own typed EN/AR i18n (no i18next). Same React 19.3.0 / `stylis` 4.2.0 rules. No Tailwind/Bootstrap, no extra UI kit, no state library.
- **Admin Portal:** React + TypeScript (TS 6) + Vite + **Material UI** (+ MUI X), Apache ECharts, React Router, TanStack Query,
  i18next, React Hook Form + Zod. Same React 19.3.0 / `stylis` 4.2.0 rules as the website. Built in approved phases.
- **React:** exactly 19.3.0 in both apps (Expo SDK 58's pin). The root `overrides` enforces a single
  React/React DOM; the website's `vite.config.ts` dedupes React. Change React only with an Expo SDK upgrade.
- **TypeScript:** root, shared-types and HR use TS 6 (ESLint tooling needs its JS API); the website keeps TS 7
  nested in its own `node_modules`. Don't hoist TS 7 to the root.

## Commands (run from the root)

| Task | Command |
| --- | --- |
| Install everything | `npm install` |
| Website | `npm run dev:website` · `build:website` · `preview:website` · `lint:website` |
| DataHubHR | `npm run dev:hr` · `android:hr` · `ios:hr` · `lint:hr` · `config:hr` · `doctor:hr` |
| Admin Portal | `npm run dev:admin` · `build:admin` · `lint:admin` · `test:admin` |
| Trainee App | `npm run dev:trainee` · `build:trainee` · `lint:trainee` · `test:trainee` |
| TypeScript | `npm run typecheck` (all) · `npm run typecheck:packages` (shared-types) |
| Lint everything | `npm run lint` |
| Full verification | `npm run verify` (typecheck → lint → website build → admin build + tests → trainee build + tests → Expo config → expo-doctor) |
| Any workspace script | `npm run <script> --workspace=<path>` |

Run `npm run verify` before declaring repository-wide work done.

## Dependency management

- One lockfile at the root. Install into a workspace with `npm install <pkg> --workspace=apps/<app>`
  (or `npx expo install <pkg>` inside the Expo app). Never add app dependencies to the root `package.json`;
  the root holds only repository tooling (TypeScript 6) and the React `overrides`.
- Don't run `npm audit fix` automatically; review advisories first.
- Git on Windows needs `core.longpaths=true` (some website content paths exceed 260 characters).

## Adding a future application (e.g. DataHub CRM, Finance, Operations)

1. `apps/<app-name>/` with its own `package.json` (`private`, unique name), tsconfig, lint config and `CLAUDE.md`.
2. Depend on `@datahub/shared-types` (`"*"`) only if it needs the shared types; keep everything else in the app.
3. Add import-boundary lint rules like the existing apps.
4. `npm install` at the root; add `dev:<app>`/`build:<app>`/`lint:<app>` root scripts and include them in
   `lint`/`verify`.
5. Update the root `README.md` and this file. Don't create apps that haven't been requested.
6. Introduce a new shared package only when two or more apps need the same runtime code.
