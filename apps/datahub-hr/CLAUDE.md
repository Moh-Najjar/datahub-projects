# CLAUDE.md — DataHubHR (apps/datahub-hr)

Expo's official guidance for this app (versioned docs, commands, Expo Router, EAS) — follow it:

@AGENTS.md

## App rules

- **Product:** HR management app with original **DataHubHR** branding. It may take inspiration from ZenHR's
  *functionality and UX patterns* only — never copy ZenHR's name, logos, assets, copy or exact screen designs.
- **Status:** foundation only. Features, roles and screens are not specified yet — do not add HR screens,
  mock data, components or business logic until a feature is requested. Mock data is planned as the first
  backend; add it only when a feature needs it.
- **Stack:** Expo SDK 58, React Native 0.88, React 19.3.0, TypeScript, Expo Router (routes in `src/app/`;
  non-route code goes in other `src/` folders, never inside `src/app/`).
- **Languages:** English and Arabic, LTR and RTL (`supportsRTL` is enabled in `app.json`). Use
  `@datahub/shared-i18n` resources where strings are shared; layout must work in both directions.
- **Dependencies:** add packages with `npx expo install <pkg>` from this folder. Never add `react-dom`, MUI or
  web UI kits. Keep `metro.config.js`'s React resolver (pins the bundle to this app's React 19.3.0).
- **Assets:** `assets/` still holds Expo's template icons/splash — replace them with DataHubHR branding
  before any release.
- Before finishing: `npm run typecheck --workspace=apps/datahub-hr`, `npm run lint:hr` and `npm run doctor:hr`
  (one known warning: duplicate `react`, by design — see the root CLAUDE.md).
- Do not modify `apps/datahub-website` or shared-package behaviour as part of HR work without saying so.
