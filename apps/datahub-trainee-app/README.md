# DataHub Trainee App

Modern training management for DataHub: trainings with content and assignments, enrollments with progress, users,
departments, evaluations, rankings, an activity timeline and printable completion certificates. English and Arabic (RTL).

It is opened from the **DataHub Workspace** (no login page). Training data comes from a persistent mock API until a backend exists.

```bash
npm run dev:trainee      # from the repository root — http://localhost:3002
npm run test:trainee
npm run build:trainee
```

Run the website too (`npm run dev:website`, port 3000), sign in at `/workspace/login/`, then open **Trainee App**.
Rules, architecture and the original-feature checklist: [CLAUDE.md](CLAUDE.md) · [docs/PARITY.md](docs/PARITY.md).
