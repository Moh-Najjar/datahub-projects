# CLAUDE.md — DataHubProjects monorepo

npm-workspaces monorepo for Datahub Analytics frontends: two independent apps and one types-only package.
Read the app-level `CLAUDE.md` before working inside an app — it contains that app's own (stricter) rules.

## Architecture

| Workspace | Path | Purpose | Its rules |
| --- | --- | --- | --- |
| DataHub Website | `apps/datahub-website/` | Faithful recreation of datahubanalytics.com (EN/AR, RTL). Recreation, **not** a redesign. | [apps/datahub-website/CLAUDE.md](apps/datahub-website/CLAUDE.md) |
| DataHubHR | `apps/datahub-hr/` | HR management mobile app. Original DataHubHR branding — inspired by ZenHR's functionality only, never its branding, logos, assets or exact screens. | [apps/datahub-hr/CLAUDE.md](apps/datahub-hr/CLAUDE.md) |
| Shared types | `packages/shared-types/` | `@datahub/shared-types`: TypeScript types used by **both** apps. | this file |

Each app owns its source, UI, routing, styling, i18n, services, utilities, constants and configuration —
all inside its own folder. There is deliberately **no** shared runtime package.

## Application boundaries (enforced by lint)

- Website must not import React Native, Expo or DataHubHR code (oxlint `no-restricted-imports`).
- DataHubHR must not import MUI, Emotion, React DOM, React Router or website code (ESLint).
- shared-types must not import React, React DOM, React Native, Expo, MUI or app code (oxlint).
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
| TypeScript | `npm run typecheck` (all) · `npm run typecheck:packages` (shared-types) |
| Lint everything | `npm run lint` |
| Full verification | `npm run verify` (typecheck → lint → website build → Expo config → expo-doctor) |
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
