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

contracts/      # Shared frontend/backend API contracts

## Layers

### Application Layer

Owns application-level behavior such as bootstrap, routing, layouts, and global concerns.

### Feature Layer

Owns business-facing functionality.

Each business capability is isolated inside its feature and contains the UI, state, and integration logic required by that feature.

### Shared Layer

Contains reusable frontend infrastructure that is not owned by a specific business feature.

Shared code must remain independent from individual features.

### Contract Layer

`contracts/` defines the public API boundary shared by frontend and backend.

The frontend consumes these contracts rather than duplicating API DTO definitions.

## Dependency Direction

Application
→ Features
→ Shared

Features
→ Contracts

`shared` must not depend on individual features.

## Related Documentation

- `module-structure.md` — internal structure of frontend features
- `data-flow.md` — frontend data flow
- `routing.md` — routing architecture
- `state-management.md` — state ownership and Pinia usage