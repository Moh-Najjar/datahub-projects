# @datahub/shared-constants

Constants shared by DataHub applications. **No secrets or environment values** — those belong in each app's environment config.

## Usage

```ts
import { LOCALES, LOCALE_DIRECTION } from '@datahub/shared-constants';
```

## Exports

`LOCALES`, `DEFAULT_LOCALE`, `LOCALE_DIRECTION`, `INTL_LOCALE`, `ORGANIZATION`.

## Rules

- Platform-independent: no DOM, no React, no React Native/Expo, no MUI.
- No `enum`/`namespace` (use `as const` objects) — consumers compile with `erasableSyntaxOnly`.
- Add only what at least two apps genuinely need; app-specific code stays in the app.
- Run `npm run typecheck --workspace=packages/<name>` after changes.
