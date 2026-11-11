# @datahub/shared-types

Common TypeScript types shared by DataHub applications. **Types only** — no runtime code.

## Usage

```ts
import type { Locale, Localized, Id } from '@datahub/shared-types';
```

## Exports

`Locale`, `Direction`, `Localized<T>`, `Id`, `ISODateString`, `Nullable<T>`, `ReadonlyRecord`, `ArrayElement`.

## Rules

- Platform-independent: no DOM, no React, no React Native/Expo, no MUI.
- No `enum`/`namespace` (use `as const` objects) — consumers compile with `erasableSyntaxOnly`.
- Add only what at least two apps genuinely need; app-specific code stays in the app.
- Run `npm run typecheck --workspace=packages/<name>` after changes.
