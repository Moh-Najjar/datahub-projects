# DataHubProjects

Monorepo for the frontend applications of **Datahub Analytics** — web and mobile apps, plus the
platform-independent packages they share. It is managed with **npm workspaces**: one install, one
lockfile, and every command can be run from this root.

## Applications

| App | Path | Stack | Status |
| --- | --- | --- | --- |
| **DataHub Website** | `apps/datahub-website` | React 19.3.1 · TypeScript 7 · Vite 8 · Material UI 9 · React Router 7 · Emotion (RTL) | Production-ready recreation of datahubanalytics.com (EN + AR) |
| **DataHubHR** | `apps/datahub-hr` | Expo SDK 58 · React Native 0.88 · React 19.3.0 · Expo Router · TypeScript 6 | Configured foundation; HR features not started |

Each app owns its UI, routing, styling and platform integrations. **UI code is never shared between apps.**

## Shared packages

| Package | Purpose |
| --- | --- |
| `@datahub/shared-types` | Common TypeScript types (`Locale`, `Direction`, `Localized<T>`, `Id`, …). Types only. |
| `@datahub/shared-constants` | Constants (`LOCALES`, `LOCALE_DIRECTION`, `INTL_LOCALE`, `ORGANIZATION`). No secrets. |
| `@datahub/shared-utils` | Platform-independent helpers (date/number formatting, `truncateWords`, validation). |
| `@datahub/shared-i18n` | Shared English/Arabic translation resources + a framework-free lookup. |
| `@datahub/shared-api` | API contracts (`ApiResult`, `Paginated`, …) and request helpers. No HTTP client. |
| `@datahub/shared-config` | Shared TypeScript bases, ESLint fragment and oxlint base. Configuration only. |

Shared packages are consumed **as TypeScript source** (their `exports` point at `src/index.ts`): Vite and
Metro transpile them and TypeScript resolves them through the workspace symlinks — no build step.
They must never depend on React, React DOM, React Native, Expo or MUI.

```ts
import { getMessages } from '@datahub/shared-i18n';
import { formatDate } from '@datahub/shared-utils';
```

To use a package in an app, add it to that app's `dependencies` (`"@datahub/shared-utils": "0.1.0"`)
and run `npm install` at the root.

## Getting started

Requirements: Node ≥ 20.19.4, npm ≥ 10. For the mobile app: Expo Go on a device, or Android Studio / Xcode
for emulators and development builds.

```bash
npm install                # installs every workspace (single root package-lock.json)
```

### DataHub Website

```bash
npm run dev:website        # Vite dev server → http://localhost:5173
npm run build:website      # type-check + production build → apps/datahub-website/dist
npm run preview:website    # serve the production build
npm run lint:website
```

Website-only tooling (asset sync, page conversion, blog export, visual comparison) runs inside the app:
`npm run <script> --workspace=apps/datahub-website` — see [apps/datahub-website/CLAUDE.md](apps/datahub-website/CLAUDE.md).

### DataHubHR

```bash
npm run dev:hr             # Expo dev server (scan the QR code with Expo Go)
npm run android:hr         # open on an Android emulator/device
npm run ios:hr             # open on an iOS simulator (macOS)
npm run lint:hr
npm run doctor:hr          # expo-doctor dependency/config checks
```

Add native-compatible libraries with `npx expo install <pkg>` **inside `apps/datahub-hr`** so versions
match Expo SDK 58.

### Whole repository

```bash
npm run typecheck          # TypeScript for every workspace
```

## Repository layout

```text
DataHubProjects/
├── apps/
│   ├── datahub-website/   React + Vite + MUI website (own CLAUDE.md, docs, scripts)
│   └── datahub-hr/        Expo + React Native app (routes in src/app/)
├── packages/
│   ├── shared-types/  shared-utils/  shared-constants/
│   ├── shared-i18n/   shared-api/    shared-config/
├── package.json           workspaces + root scripts
├── package-lock.json      the only lockfile
└── CLAUDE.md              monorepo rules
```

## Dependency notes

- **React versions are intentionally different:** the website uses React 19.3.1, Expo SDK 58 pins 19.3.0.
  The mobile bundle is pinned to its own copy in `apps/datahub-hr/metro.config.js`; `expo-doctor` reports the
  duplicate as expected. Aligning both on one version is a deliberate future decision.
- **TypeScript:** the root and shared packages use TypeScript 6 (it exposes the JS API ESLint tooling needs);
  the website keeps TypeScript 7 (native compiler) in its own `node_modules`.

## Adding a new application

1. Create it under `apps/<app-name>/` (e.g. `apps/datahub-crm`) with its own `package.json`
   (`"private": true`, unique `name`) and its own `CLAUDE.md`.
2. Depend on the shared packages it needs (`"@datahub/shared-types": "0.1.0"`, …); extend
   `@datahub/shared-config/tsconfig/base.json` where compatible.
3. Run `npm install` at the root, then add `dev:<app>` / `build:<app>` scripts to the root `package.json`.
4. Document it in this README and in the root `CLAUDE.md`.

## Conventions

- TypeScript strict mode everywhere; no `any`.
- Shared packages: `as const` objects instead of `enum` (the website compiles them with `erasableSyntaxOnly`).
- Never commit secrets: `.env*` files are ignored; commit an `.env.example` when an app needs configuration.
- Line endings are normalised to LF (`.gitattributes`).
