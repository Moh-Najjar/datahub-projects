# @datahub/shared-config

Shared development configuration. Contains configuration only — no runtime code.

| File | Use |
| --- | --- |
| `tsconfig/base.json` | Strict TypeScript base for any workspace. |
| `tsconfig/library.json` | Base for `packages/*`: no DOM, no React Native globals, `erasableSyntaxOnly` (no `enum`/`namespace`). |
| `eslint/base.mjs` | Dependency-free ESLint flat-config fragment (code-quality rules). Used by apps that lint with ESLint. |
| `oxlint/base.json` | oxlint base used to lint the shared packages. |

```jsonc
// packages/<name>/tsconfig.json
{ "extends": "@datahub/shared-config/tsconfig/library.json", "include": ["src"] }
```

Platform-specific settings (Vite/DOM for the website, Expo/React Native for the HR app) stay inside each app.
