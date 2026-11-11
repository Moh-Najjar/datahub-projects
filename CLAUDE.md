# CLAUDE.md — DataHubProjects monorepo

npm-workspaces monorepo for Datahub Analytics frontends. Read the app-level `CLAUDE.md` before working
inside an app — it contains that app's own (stricter) rules.

## Applications

| App | Path | Purpose | Its rules |
| --- | --- | --- | --- |
| DataHub Website | `apps/datahub-website/` | Faithful recreation of datahubanalytics.com (EN/AR, RTL). Recreation, **not** a redesign. | [apps/datahub-website/CLAUDE.md](apps/datahub-website/CLAUDE.md) |
| DataHubHR | `apps/datahub-hr/` | HR management mobile app (future). Original DataHubHR branding — inspired by ZenHR's functionality, never its branding, logos, assets or exact screens. | [apps/datahub-hr/AGENTS.md](apps/datahub-hr/AGENTS.md) (Expo guidance) |

All source code of an app lives inside its folder. Never put app code at the root or in another app.

### Technology restrictions

- **Website:** React + TypeScript + Vite + **Material UI** (Emotion, RTL via `stylis-plugin-rtl`), React Router,
  Framer Motion, React Hook Form + Zod. No Tailwind/Bootstrap/other UI kits. Keep `stylis` at 4.2.0.
- **DataHubHR:** Expo SDK 58 + React Native + TypeScript + **Expo Router** (routes in `src/app/`).
  Install libraries with `npx expo install` from `apps/datahub-hr`. No web UI libraries, no MUI, no React DOM.
  HR features have not been specified yet — don't add screens, mock data or business logic speculatively.

## Shared packages (`packages/*`)

| Package | Contains |
| --- | --- |
| `shared-types` | Types only (locales, ids, generic helpers). |
| `shared-constants` | `as const` constants. Never secrets or environment values. |
| `shared-utils` | Pure functions using ECMAScript + `Intl` only. |
| `shared-i18n` | EN/AR resources + framework-free lookup; apps own their i18n integration. |
| `shared-api` | API contracts and pure request helpers; apps own their HTTP clients. |
| `shared-config` | TypeScript bases, ESLint fragment, oxlint base. Config only. |

Rules (mandatory):

1. No dependency on React, React DOM, React Native, Expo or MUI — and no UI components.
2. No DOM, `window`, Node-only or React-Native-only APIs.
3. No `enum`/`namespace` — consumers compile with `erasableSyntaxOnly`; use `as const` + union types.
4. Packages are consumed as TS source (`exports` → `src/index.ts`); keep `exports` and `types` correct.
5. Only move code into a package when **two or more apps genuinely need it**. Don't copy website code into
   packages "just in case", and don't refactor an app to use a package unless that is the task.
6. Keep dependencies minimal; inter-package deps use the exact workspace version (`"0.1.0"`).

## Working rules

- **Stay in scope:** when working on one app, do not modify another app. Shared-package changes must keep
  every consumer building — run `npm run typecheck` (all workspaces) after touching `packages/*`.
- Root-level files (`package.json`, lockfile, `.gitignore`, `.gitattributes`, docs) change only for
  repository-wide concerns.

## Commands (run from the root)

| Task | Command |
| --- | --- |
| Install everything | `npm install` |
| Website dev / build / preview / lint | `npm run dev:website` · `npm run build:website` · `npm run preview:website` · `npm run lint:website` |
| HR dev server / Android / iOS / web | `npm run dev:hr` · `npm run android:hr` · `npm run ios:hr` · `npm run web:hr` |
| HR lint / doctor | `npm run lint:hr` · `npm run doctor:hr` |
| Type-check all workspaces | `npm run typecheck` |
| Any workspace script | `npm run <script> --workspace=<path>` |

## Dependency management

- One lockfile at the root; never run `npm install` inside a workspace folder without `--workspace`
  (use `npm install <pkg> --workspace=apps/<app>`), except `npx expo install` in the Expo app.
- Each app declares its own dependencies; never add app dependencies to the root `package.json`
  (the root only holds repository tooling: TypeScript 6).
- **React:** website 19.3.1, Expo app 19.3.0 (pinned by SDK 58). `apps/datahub-hr/metro.config.js` pins the
  mobile bundle to its own React — keep that resolver. Never add `react-dom` to the Expo app or
  `react-native` to the website.
- **TypeScript:** root/packages/Expo app use TS 6 (needed by ESLint tooling); the website keeps TS 7 nested in
  its own `node_modules`. Don't hoist TS 7 to the root.
- Git: `core.longpaths=true` is required on Windows (some blog content paths exceed 260 characters).

## TypeScript & code quality

- `strict` everywhere, plus `noUncheckedIndexedAccess`; no `any`.
- Shared packages extend `@datahub/shared-config/tsconfig/library.json`.
- Linting: website → oxlint; Expo app → ESLint (`eslint-config-expo` + `@datahub/shared-config/eslint/base.mjs`).
- Before finishing a change: `npm run typecheck` and the affected app's lint/build.

## Adding a future application (e.g. DataHub CRM, Finance, Operations)

1. `apps/<app-name>/` with its own `package.json` (`private`, unique name), tsconfig and `CLAUDE.md`.
2. Use the shared packages through dependencies; keep UI inside the app.
3. `npm install` at the root; add `dev:<app>`/`build:<app>` root scripts.
4. Update the root `README.md` and this file. Don't create apps that haven't been requested.
