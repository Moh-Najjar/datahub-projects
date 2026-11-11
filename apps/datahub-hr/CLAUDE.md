# CLAUDE.md — DataHubHR (apps/datahub-hr)

Expo's official guidance for this app (versioned docs, commands, Expo Router, EAS) — follow it:

@AGENTS.md

## Product

- HR management app with original **DataHubHR** branding. It may take inspiration from ZenHR's
  *functionality and UX patterns* only — never copy ZenHR's name, logos, assets, copy or exact screen designs.
- **Status: foundation only.** Features, roles and screens are not specified yet — do not add HR screens,
  mock data, components or business logic until a feature is requested. Mock data is planned as the first
  backend; add it in `src/services/` only when a feature needs it.

## Stack

Expo SDK 58 · React Native 0.88 · React 19.3.0 · TypeScript · Expo Router.

## Project layout

- `src/app/` — Expo Router routes only (`_layout.tsx` files define navigators). Non-route code never goes here.
- `src/i18n/` — this app's translations and locale detection (`locales.ts`, `messages.ts`).
- Create other `src/` folders (`components/`, `features/`, `hooks/`, `services/`, `theme/`, `types/`,
  `utils/`) when the first code that belongs there is written — not in advance.
- Import app code with the `@/` alias (`@/i18n/messages` → `src/i18n/messages.ts`).
- Shared cross-app types come from `@datahub/shared-types` (types only). Everything else is app-owned.

## Internationalisation (EN/AR, LTR/RTL)

- Every UI string lives in `src/i18n/messages.ts` for both languages (`Localized<Messages>` enforces parity).
- The language follows the device (`getDeviceLocale()` via `expo-localization`). `supportsRTL` in `app.json`
  lets React Native mirror the layout automatically when the device language is RTL.
- When an in-app language switch is built: persist the choice, call `I18nManager.allowRTL(true)` and
  `I18nManager.forceRTL(isRtl)`, then reload the app (`expo-updates`' `reloadAsync()` or a restart prompt) —
  React Native applies direction changes only on restart.
- Write direction-agnostic styles: `start`/`end` (`marginStart`, `paddingEnd`, `textAlign: 'auto'`) instead of
  `left`/`right`.

## Rules

- **Dependencies:** add packages with `npx expo install <pkg>` from this folder. Never add `react-dom`, MUI,
  Emotion, React Router or web UI kits — ESLint blocks them (`no-restricted-imports`).
- Never import website code; share types only through `@datahub/shared-types`.
- Keep `metro.config.js` watching only the root `node_modules` and `packages/shared-types`.
- Do not modify `apps/datahub-website` as part of HR work.
- Before finishing: `npm run typecheck --workspace=apps/datahub-hr`, `npm run lint:hr`, `npm run config:hr`
  and `npm run doctor:hr` (must pass 20/20).

## Before the first native/store build (needs product-owner input)

`app.json` currently has no `android.package` / `ios.bundleIdentifier`, there is no `eas.json` / EAS project,
and `assets/` holds Expo's template icons (`splash-icon.png` is not referenced; no splash config). Development
with Expo Go is unaffected. Needed: reverse-domain identifiers, an Expo account for `eas init`, and DataHubHR
icon/adaptive-icon/splash artwork with brand colours.
