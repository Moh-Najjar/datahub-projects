# @datahub/shared-api

API contracts and platform-independent request helpers. Contains **no HTTP client** — each app performs requests with its own platform integration.

## Usage

```ts
import { toQueryString, type ApiResult } from '@datahub/shared-api';
```

## Exports

`HttpMethod`, `ApiErrorBody`, `ApiResult<T>`, `Paginated<T>`, `Timestamps`, `isApiFailure`, `QueryParams`, `toQueryString`, `joinUrl`.

## Rules

- Platform-independent: no DOM, no React, no React Native/Expo, no MUI.
- No `enum`/`namespace` (use `as const` objects) — consumers compile with `erasableSyntaxOnly`.
- Add only what at least two apps genuinely need; app-specific code stays in the app.
- Run `npm run typecheck --workspace=packages/<name>` after changes.
