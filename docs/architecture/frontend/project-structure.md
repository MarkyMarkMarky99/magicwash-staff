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

## Structure

src/
├── app/        # Application-level concerns
├── features/   # Business features
├── shared/     # Cross-feature reusable infrastructure
├── router/     # Application routing
└── assets/     # Static assets

contracts/      # Shared frontend/backend API contracts (schemas, enums, and contract-shape types)
shared/         # Runtime logic shared by frontend and backend

## Layers

### Application Layer

Owns application-level behavior such as bootstrap, routing, layouts, and global concerns.

### Feature Layer

Owns business-facing functionality.

Each business capability is isolated inside its feature and contains the UI, state, and integration logic required by that feature.

### Shared Layer

`src/shared/` contains reusable frontend infrastructure that is not owned by a specific
business feature.

It is frontend-only. The backend never imports from it.

Shared code must remain independent from individual features.

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

## Dependency Direction

Application
→ Features
→ Shared

Features
→ Contracts
→ Shared Runtime

`src/shared` must not depend on individual features.

`shared/` and `contracts/` must not depend on `src/`.

## Related Documentation

- `feature-structure.md` — internal structure of frontend features
- `../../conventions/components.md` — shared vs feature component ownership
- `../../design/patterns/forms.md` — routed form pages and shared form controls

Feature routes are aggregated by spreading each feature's exported `*Routes` array into `src/router/index.js`; there are no nested `children` routes.
