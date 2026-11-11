# @datahub/shared-i18n

Shared English/Arabic translation **resources** and a framework-free lookup. Each app keeps its own i18n integration (web: React context; mobile: expo-localization + `I18nManager`) and consumes these resources.

## Usage

```ts
import { getMessages } from '@datahub/shared-i18n';

getMessages('ar').organization.name; // 'داتا هب أناليتكس'
```

## Exports

`messages`, `getMessages`, `Messages` (every key exists in both languages — enforced by the type).

## Rules

- Platform-independent: no DOM, no React, no React Native/Expo, no MUI.
- No `enum`/`namespace` (use `as const` objects) — consumers compile with `erasableSyntaxOnly`.
- Add only what at least two apps genuinely need; app-specific code stays in the app.
- Run `npm run typecheck --workspace=packages/<name>` after changes.
