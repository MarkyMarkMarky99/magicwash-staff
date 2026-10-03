---
last_audited: 2026-08-26
audit_sources:
  - src/main.js
  - src/App.vue
  - src/router/index.js
  - src/features/customers/routes.ts
  - src/shared/api
---

# Frontend Project Structure

The frontend is a Vue 3 application organized around business features with shared application infrastructure.

The architecture separates route-level application concerns, business features, and reusable cross-feature code.

## Technology

- Vue 3 with TypeScript
- Pinia for feature and application state
- Vue Router for application routing
- Vite for development and production builds

## Structure

src/
├── app/        # Optional application-level pages and development tools
├── features/   # Business features
├── data/       # Resource/table data access and shared table state
├── shared/     # Cross-feature reusable infrastructure
├── router/     # Application routing
└── assets/     # Static assets

contracts/      # Shared frontend/backend API contracts (schemas, enums, and contract-shape types)
shared/         # Runtime logic shared by frontend and backend

## Layers

### Application Layer

Application-level behavior is owned by the root entry points: `src/main.js` bootstraps the app,
`src/App.vue` owns the root shell, and `src/router/index.js` owns routing. Use `src/app/` only for
application-level pages or development tools when one is needed.

- The application root may provide data-layer state to shared shell components through typed
  injection keys owned by `src/shared/`; shared code must not import the data layer directly.

#### Staff sign-in

- Staff sign in with Google through Firebase Auth (popup). `src/shared/api/firebase-auth.ts` wraps
  the Firebase calls and provides `authFetch`, which attaches the Firebase ID token as
  `Authorization: Bearer`. Every `/api` request goes through it, including services that call
  `fetch` for outcome handling.
- `src/data/auth/auth.store.ts` owns the session. After Firebase signs a user in, it calls
  `GET /api/auth/me`. Its `status` is `loading`, `signedOut`, `signedIn`, `unregistered`, or
  `pending`. On a 403 the Google session is kept and the store calls `GET /api/staff/me`: a 404 is
  `unregistered` (the login page sends the user to `/staff/register`); a row with no role or
  `active = false` is `pending` (the login page shows "ลงทะเบียนแล้ว รอผู้ดูแลอนุมัติ" with a logout
  button). Only `signedIn` counts as signed in as staff. A 403 followed by an already usable row,
  a 401, or any other error signs the user out with an error on the login page. See
  `docs/features/staff/registration.md`.
- `App.vue` starts the session check on mount and provides `isAdmin` to `NavSidebar` through
  `staffAdminKey` (`src/shared/staff-admin.ts`), which shows the staff-management entry to admins only.
- Sign-in is optional: no route requires it. `/login` is reached from the nav menu, which shows
  "เข้าสู่ระบบ" when signed out and "ออกจากระบบ" when signed in. The login page has a close button,
  and after signing in it leaves the same way (history back, or `/` without history); a
  `?redirect=` app path takes precedence.
- Writes use `currentActor()` to record the signed-in StaffId, or `unknown` when signed out;
  `?by=` is ignored. The app prefetches the public staff list at load to map StaffIds to names.

### Feature Layer

- Owns business-facing workflow functionality.
- Defines workflows rather than table ownership.
- May use data from every table its workflow needs.

### Data Layer

- Each resource uses one `src/data/<resource>/` folder.
- Import data modules through `@/data/<resource>/...`.
- It holds the resource API service for all `/api/<resource>` requests.
- It owns the Pinia store for shared table data when shared state is needed.
- Each table has one canonical full-list query; pages and pickers derive their filters and ordering
  from that shared result so URL-keyed cache entries are reused.
- Loaded shared table stores subscribe to their resource invalidation and re-read automatically, so
  kept-alive pages do not retain data made stale by another workflow.
- It is the only frontend code that calls `src/shared/api` for its resource.
- It invalidates its resource cache after writes.
- It invalidates related resource caches affected by its writes.
- Work-order, order-item, and invoice writes invalidate the order-history view; customer-package
  and package-transaction writes invalidate both package resources.
- Outcome-based writes also invalidate after any confirmed or unknown outcome that may have
  persisted data, not only the fully successful outcome.
- It uses the existing shared API-client cache and `src/shared/config/cache.ts`.
- It does not add another cache.
- When a canonical list reaches its API row cap, the data store exposes a truncation flag and every
  staff-facing list or picker using it shows an incomplete-list notice.
- The canonical customer list uses the existing 2,000-row request cap; a response with exactly
  2,000 rows is treated as potentially incomplete.

### Shared Layer

`src/shared/` contains reusable frontend infrastructure that is not owned by a specific
business feature.

It is frontend-only. The backend never imports from it.

- Shared code must remain independent from individual features and `src/data/`.

### Contract Layer

`contracts/` defines the public API boundary shared by frontend and backend.

It holds zod schemas, enums, and API contract-shape types describing request and
response shape. Runtime logic — calculations, formatting, transformations — does not
belong there, even when both sides need it.

The frontend consumes these contracts rather than duplicating API DTO definitions.

### Shared Runtime Layer

`shared/` at the repository root holds runtime logic that the frontend and the backend
must execute identically, such as money calculation shown as a form preview and applied
again to the value the backend stores, and random id generation in `shared/utils/id.ts`.
The id helper supports prefixed short hex ids and unbiased generation from custom alphabets.
Short ids exclude all-digit and digits-e-digits values so Sheets keeps them as text.

Duplicating such logic lets the two copies diverge silently, so a single implementation
is imported by both.

Only add code here when both runtimes genuinely need it. Frontend-only code stays in
`src/shared/`.

### The Three Shared Folders

| Folder | Owner | Imported by |
|---|---|---|
| `src/shared/` | Frontend only | Frontend, via `@/shared/…` |
| `server/shared/` | Backend only | Backend, via relative `.js` |
| `shared/` | Both runtimes | Frontend via `@shared/…`, backend via relative `.js` |

The names repeat, so read the import path rather than the folder name: `@/shared/x`
and `@shared/x` are different files.

## Path Aliases

| Alias | Target | Declared in |
|---|---|---|
| `@/` | `src/` | `vite.config.js`, `jsconfig.json` |
| `@contracts/` | `contracts/` | `vite.config.js`, `jsconfig.json` |
| `@shared/` | `shared/` | `vite.config.js`, `jsconfig.json` |

Aliases are frontend-only. The backend resolves `contracts/` and `shared/` through
relative paths with explicit `.js` extensions, because `api/tsconfig.json` declares no
`paths` mapping.

Adding an alias means editing both `vite.config.js` (build resolution) and
`jsconfig.json` (editor and `tests/web/` resolution); changing only one leaves the other
silently broken.

Prefer an alias over a deep relative import. Use `import type` when an import is used only as a
TypeScript type.

## Dependency Direction

Application
→ Features
→ Data
→ Shared

Features
→ Contracts
→ Shared Runtime

`src/data/` may import `contracts/`, root `shared/`, and `src/shared/`; it must not import from `src/features/`.

Features must not import another feature's services or stores for table data; use `src/data/`.

`src/shared/` must not depend on individual features or `src/data/`.

`shared/` and `contracts/` must not depend on `src/`.

## Related Documentation

- `feature-structure.md` — internal structure of frontend features
- `../../conventions/components.md` — shared vs feature component ownership
- `../../design/patterns/forms.md` — routed form pages and shared form controls

Feature routes are aggregated by spreading each feature's exported `*Routes` array into `src/router/index.js`; there are no nested `children` routes.
