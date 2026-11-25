# DataHub Website

React 19 + TypeScript + Vite + Material UI recreation of [datahubanalytics.com](https://datahubanalytics.com/),
in English (LTR) and Arabic (RTL, under `/ar/`).

```bash
npm install
npm run assets        # download original images, logos and the Satoshi font into public/
npm run dev           # http://localhost:3000
npm run build         # type-check + production build
```

Content tooling (re-sync from the live site): `npm run pages:convert`;
QA: `npm run check:links`, `npm run compare -- http://localhost:3000 1440 [ar]`.

**Deploying:** this is a client-side routed SPA with WordPress-style URLs (`/about-us/`, `/ar/...`, `/<post-slug>/`).
Configure the host to serve `index.html` for unknown paths (e.g. Netlify `/* /index.html 200`, Nginx
`try_files $uri $uri/ /index.html`). `dist/` is ~56 MB, mostly blog WebP images.

The appointment / contact forms send inquiries to the backend API (`POST /api/v1/contact/inquiries`, base URL
`VITE_API_URL`) and report "sent" only when the API accepted them.

See [docs/PLAN.md](docs/PLAN.md) for the implementation plan and [CLAUDE.md](CLAUDE.md) for development rules.
