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

### Feature Layer

- Owns business-facing workflow functionality.
- Defines workflows rather than table ownership.
- May use data from every table its workflow needs.

### Data Layer

- Each resource uses one `src/data/<resource>/` folder.
- Import data modules through `@/data/<resource>/...`.
- It holds the resource API service for all `/api/<resource>` requests.
- It owns the Pinia store for shared table data when shared state is needed.
- It is the only frontend code that calls `src/shared/api` for its resource.
- It invalidates its resource cache after writes.
- It invalidates related resource caches affected by its writes.
- It uses the existing shared API-client cache and `src/shared/config/cache.ts`.
- It does not add another cache.
- Transitional: Feature-local table-data services and stores move here one resource at a time without changing request URLs, query parameters, filtering, or cache timing.

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
again to the value the backend stores.

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
