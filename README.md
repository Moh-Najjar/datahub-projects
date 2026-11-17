# DataHubProjects

Monorepo for the frontend applications of **Datahub Analytics**, managed with **npm workspaces**:
one install, one lockfile, and every command runs from this root.

The architecture is intentionally simple: **two independent applications** and **one shared package**
containing only TypeScript types both apps genuinely use.

```text
DataHubProjects/
├── apps/
│   ├── datahub-website/   React + Vite + MUI website (own CLAUDE.md, docs, scripts)
│   ├── datahub-hr/        Expo + React Native app (routes in src/app/)
│   └── datahub-hr-admin-portal/   React + Vite + MUI admin web app for DataHubHR (own CLAUDE.md)
├── packages/
│   └── shared-types/      @datahub/shared-types — shared TypeScript types only
├── package.json           workspaces, root scripts, React version policy
├── package-lock.json      the only lockfile
├── CLAUDE.md              monorepo rules
└── README.md
```

## Applications

| App | Path | Stack | Status |
| --- | --- | --- | --- |
| **DataHub Website** | `apps/datahub-website` | React 19.3.0 · TypeScript 7 · Vite 8 · Material UI 9 · React Router 7 · Emotion (RTL) | Production-ready recreation of datahubanalytics.com (EN + AR) |
| **DataHubHR** | `apps/datahub-hr` | Expo SDK 58 · React Native 0.88 · React 19.3.0 · Expo Router · TypeScript 6 | Configured foundation; HR features not started |
| **DataHub HR Admin Portal** | `apps/datahub-hr-admin-portal` | React 19.3.0 · TypeScript 6 · Vite 8 · Material UI 9 · Apache ECharts 6 · React Router 7 · TanStack Query 5 · i18next (EN + AR, RTL) | Phase 5 (in progress): app shell, demo sign-in per role (mock — not real authentication), role-based navigation, HR dashboard (KPIs, Apache ECharts charts), Organization Management (departments, positions, locations, hierarchy), Employee Management (directory, profiles, create/edit, documents, history), Attendance Management (records, simulated check-in/out, shifts, history, reports, CSV), Leave Management (requests, approvals, balances, leave types, calendar, reports, CSV; approved leave shows in Attendance), Recruitment (requisitions, candidates, pipeline, interviews, offers, hire-to-employee conversion), Performance (review cycles, goals, self/manager reviews, competencies, development plans). Mock data only — no backend yet |

Each app owns its UI, routing, styling, i18n, services, utilities and configuration. Apps never import
each other, and **UI code is never shared** — lint rules enforce this (see *Application boundaries*).

## Shared package: `@datahub/shared-types`

Types only — no runtime code, no dependencies. Today it contains the locale types both apps use:

```ts
import type { Locale, Direction, Localized } from '@datahub/shared-types';
```

- Consumed as TypeScript source (`exports` → `src/index.ts`): Vite and Metro read it directly, no build step.
- Apps depend on it with `"@datahub/shared-types": "*"`; npm workspaces link it locally (the lockfile has
  no registry entry for `@datahub/*`, and the package is `private`).
- Add a type only when **both** apps need it. App-specific types stay in the app.

## Getting started

Requirements: Node ≥ 20.19.4, npm ≥ 10. For the mobile app: Expo Go on a device, or Android Studio / Xcode
for emulators and development builds.

### Windows: long paths

Some website content files have paths longer than Windows' 260-character limit. Clone with long-path
support enabled:

```bash
git clone -c core.longpaths=true <repository-url>
```

For an existing clone: `git config core.longpaths true`.

### Install

```bash
npm install                # installs every workspace (single root package-lock.json)
```

## Commands (from the root)

### DataHub Website

```bash
npm run dev:website        # Vite dev server → http://localhost:5173
npm run build:website      # type-check + production build → apps/datahub-website/dist
npm run preview:website    # serve the production build
npm run lint:website       # oxlint
```

Website-only tooling (asset sync, page conversion, blog export, visual comparison) runs inside the app:
`npm run <script> --workspace=apps/datahub-website` — see [apps/datahub-website/CLAUDE.md](apps/datahub-website/CLAUDE.md).

### DataHubHR

```bash
npm run dev:hr             # Expo dev server (scan the QR code with Expo Go)
npm run android:hr         # open on an Android emulator/device
npm run ios:hr             # open on an iOS simulator (macOS only)
npm run lint:hr            # ESLint (eslint-config-expo)
npm run config:hr          # validate the Expo app config
npm run doctor:hr          # expo-doctor dependency/config checks
```

Add native-compatible libraries with `npx expo install <pkg>` **inside `apps/datahub-hr`** so versions match
Expo SDK 58. There is no web target for DataHubHR yet.

### DataHub HR Admin Portal

```bash
npm run dev:admin          # Vite dev server → http://localhost:5174
npm run build:admin        # type-check + production build → apps/datahub-hr-admin-portal/dist
npm run lint:admin         # oxlint (incl. architecture boundaries)
npm run test:admin         # Vitest
```

Runs on a **simulated (mock) backend** with fictional data — see
[apps/datahub-hr-admin-portal/CLAUDE.md](apps/datahub-hr-admin-portal/CLAUDE.md).

### Whole repository

```bash
npm run typecheck          # TypeScript for every workspace
npm run typecheck:packages # TypeScript for shared-types
npm run lint               # website + HR + admin portal + shared-types
npm run verify             # typecheck → lint → website build → admin build + tests → Expo config → expo-doctor
```

## Dependency policy

- **One React version:** both apps use React 19.3.0 (the version Expo SDK 58 requires). The root
  `overrides` keeps a single React/React DOM in the tree, and the website's Vite config dedupes React.
  Upgrade React only together with an Expo SDK upgrade, in both apps at once.
- **TypeScript:** the root, shared-types and DataHubHR use TypeScript 6 (ESLint tooling needs its JS API);
  the website keeps TypeScript 7 (native compiler) in its own `node_modules`.
- Each app declares its own dependencies. Never add app dependencies to the root `package.json`.

## Application boundaries

| Code in | Must not import | Enforced by |
| --- | --- | --- |
| `apps/datahub-website` | React Native, Expo, DataHubHR code | oxlint `no-restricted-imports` |
| `apps/datahub-hr` | MUI, Emotion, React DOM, React Router, website code | ESLint `no-restricted-imports` |
| `packages/shared-types` | React, React DOM, React Native, Expo, MUI, app code | oxlint `no-restricted-imports` |

## Adding a new application

1. Create `apps/<app-name>/` (e.g. `apps/datahub-crm`) with its own `package.json` (`"private": true`,
   unique `name`), tsconfig, lint config and `CLAUDE.md`.
2. Add `"@datahub/shared-types": "*"` only if it needs the shared types.
3. Add its import-boundary lint rules (mirror the table above).
4. Run `npm install` at the root; add `dev:<app>` / `build:<app>` / `lint:<app>` scripts and include them in
   `lint` and `verify`.
5. Document it in this README and in the root `CLAUDE.md`.

Add a new shared package only when two or more apps need the same **runtime** code — not in advance.

## Conventions

- TypeScript strict mode everywhere; no `any`.
- `shared-types`: no `enum`/`namespace` (the website compiles it with `erasableSyntaxOnly`).
- Never commit secrets: `.env*` files are ignored; commit an `.env.example` when an app needs configuration.
- Line endings are normalised to LF (`.gitattributes`).
