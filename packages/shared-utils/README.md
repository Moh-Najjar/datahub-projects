# @datahub/shared-utils

Platform-independent utilities (ECMAScript + `Intl` only; works in browsers, Node and Hermes).

## Usage

```ts
import { formatDate, isEmail } from '@datahub/shared-utils';
```

## Exports

`getDirection`, `isRtl`, `formatDate`, `formatNumber`, `truncateWords`, `isNonEmptyString`, `isEmail`.

## Rules

- Platform-independent: no DOM, no React, no React Native/Expo, no MUI.
- No `enum`/`namespace` (use `as const` objects) — consumers compile with `erasableSyntaxOnly`.
- Add only what at least two apps genuinely need; app-specific code stays in the app.
- Run `npm run typecheck --workspace=packages/<name>` after changes.
