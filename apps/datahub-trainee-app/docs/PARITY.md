# Feature parity — original Training Portal → DataHub Trainee App

Source of truth: the original repository (`backend/` services + validators, `frontend/` pages), inspected in full.
The screenshots only show part of it. Roles in the original: `SuperAdmin`, `DepartmentAdmin`, `Trainee`, `Employee`,
`Intern` (a Trainer role does not exist — it was renamed to Trainee in a migration).

Status legend: **Done** = implemented and covered by tests · **Changed** = intentional, documented deviation.

## Entities and statuses (preserved verbatim)

| Entity | Fields / values |
| --- | --- |
| Training status | Draft, Published, Archived |
| Enrollment status | Assigned, InProgress (shown "In Progress"), Completed |
| Assignment status (computed, never stored) | Upcoming (now < opensAt), Open, Closed (now > closesAt) |
| Material type | Text, Link, File |
| Evaluation | score 1–10 per category; **max total = categories × 10**; total = sum of scores |

## Feature matrix

| # | Original page / service | Operations & rules | New module | Mock API |
| --- | --- | --- | --- | --- |
| 1 | `LoginPage`, `AuthController` | Own login with password | — | **Changed**: replaced by DataHub Workspace SSO (`/sso`); no login form, no passwords |
| 2 | `TrainingsPage`, `TrainingService` | List (ordered by sortOrder, then newest), create (title ≤ 200, description required, department; trainer = current user; sortOrder = max+1 in department; starts Draft), delete (cascade), drag-and-drop reorder (department-scoped) | `trainings` | getAll, create, delete, reorder |
| 3 | `TrainingDetailPage` | Edit title / description / status (Draft·Published·Archived) | `trainings` | getById, update |
| 4 | `TrainingContentPage`, `MaterialEditPage`, `MaterialTextPage`, `TrainingMaterialService` | Text material (title ≤ 200, content), Link material (title + ≥1 links, absolute URL ≤ 2048), File material (title + ≥1 files; ≤ 100 MB; extension allow-list); add/edit/delete file items and link items, rename group, delete material, drag reorder | `trainings` (content tab) | materials CRUD + reorder |
| 5 | `AssignmentsSection`, `TrainingAssignmentsPage`, `AssignmentService` | Create/edit/delete assignment (title ≤ 200, description, closesAt > opensAt), attachments, computed status | `trainings` (assignments tab) | assignments CRUD |
| 6 | `AssignmentSubmissionsPage`, `AssignmentSubmissionService` | Trainee/Employee/Intern submit text (≤ 4000) + attachments **only while Open**; staff see every enrolled user with their submission | `trainings` | submissions get/upsert/overview |
| 7 | `EnrollmentsPage`, `EnrollmentService` | Assign training → user (duplicate = Conflict); assignable users = active Intern/Trainee/Employee; status update (any status, CompletedAt = now when Completed else cleared); delete | `enrollments` | CRUD + status |
| 8 | `RankingsPage`, `EvaluationService.GetRankings` | Active Trainee/Employee/Intern; latest evaluation by date; order = evaluated first, then latest total desc, then name; shows "total of max", evaluation count, last date | `rankings` | getAll |
| 9 | `UserEvaluationsPage`, `EvaluationService` | Create / edit / delete evaluation; default 10 categories (preserved); new evaluation re-uses the previous evaluation's categories at score 5; optional link to one of the user's enrollments; add/remove categories (≥ 1) | `evaluations` | CRUD |
| 10 | `UsersPage`, `UserService` | List, create, edit, delete, activate/deactivate; email normalised (trim + no spaces), unique (Conflict); role ∈ 5 roles; department | `users` | CRUD |
| 11 | `DepartmentsPage`, `DepartmentService` | SuperAdmin: create/rename/delete, unique name; shows user count and training count | `departments` | CRUD |

## Role / permission matrix (original `PolicyNames` + service checks)

| Capability | SuperAdmin | DepartmentAdmin | Trainee | Intern | Employee |
| --- | --- | --- | --- | --- | --- |
| Departments (manage) | ✔ all | read own only | — | — | — |
| Users (list/create/edit/delete) | ✔ all, any role | own department only; may assign only Intern/Trainee/Employee | — | — | — |
| Trainings (author, delete, reorder) | ✔ all | own department | — | — | — |
| Trainings (view) | ✔ all | own department | only **Published** + **enrolled** | same | same |
| Materials / assignments (author) | ✔ | own department | — | — | — |
| Materials / assignments (view) | ✔ | own department | only if enrolled | same | same |
| Submit assignment (while Open) | — | — | ✔ | ✔ | ✔ |
| View submissions overview | ✔ | own department | — | — | — |
| Enrollments (manage) | ✔ all | own-department trainings, only Intern/Trainee/Employee users | — | — | — |
| Rankings | ✔ all | users of the department or enrolled in its trainings; evaluations scoped to the department | — | — | — |
| Evaluations (create/edit/delete) | ✔ | department context = enrollment's training department, else user's department | — | — | — |

Trainee, Intern and Employee are **identical** in the original — they are kept as three distinct roles with the same permissions.

## Additions requested for the new app

Training progress (enrollment `progress` 0–100, 100 ⇒ Completed), activity timeline, printable completion certificate.

## Intentional deviations (all documented)

1. **No password field / login** — authentication is the DataHub Workspace.
2. **Rich text → plain multi-line text** for text materials (the original used the Quill editor; no new editor dependency was added).
3. **Files are simulated** — name, size and type are validated and stored, bytes are not (no download), like the HR portal's documents.
4. **Department delete is blocked while it still has users or trainings** (the original soft-deleted it and left orphans).
5. **Enrollment training picker excludes Archived trainings** (the original listed every training).
6. Training **start / end dates and duration** are optional additions (needed for deadlines); capacity was not added (no original rule).
