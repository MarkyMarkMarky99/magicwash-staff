---
last_audited: 2026-08-26
audit_sources:
  - api/[...path].ts
  - server/api/route-registry.ts
  - server/shared/http/crud-routes.ts
  - server/modules/customers/customer.module.ts
  - server/modules/invoices/invoice.service.ts
  - server/sheets/Customers/Customers.repository.ts
---

# Backend Project Structure

The backend is a TypeScript serverless application organized into routing, business modules, persistence, and shared infrastructure.

The architecture separates HTTP transport, business logic, storage access, and the public API contract.

## Structure

api/            # Serverless entry point

server/
├── api/        # Backend routing
├── modules/    # Business logic
├── sheets/     # Persistence layer
└── shared/     # Shared backend infrastructure

contracts/      # Public frontend/backend API contracts (schemas, enums, and contract-shape types)
shared/         # Runtime logic shared by frontend and backend

## Layers

### Gateway Layer

`api/` exposes the Vercel serverless entry point.

It forwards requests into the backend application and does not contain business logic.

### Routing Layer

`server/api/` resolves incoming API requests and delegates them to the appropriate business module.

### Module Layer

`server/modules/` owns business behavior.

Modules coordinate validation, business rules, services, and persistence access.

### Persistence Layer

`server/sheets/` owns access to physical Google Sheets data.

Database shape and storage behavior remain isolated from the public API contract.

### Shared Infrastructure

`server/shared/` contains reusable backend infrastructure used across modules.

It is backend-only. The frontend never imports from it.

### Contract Layer

`contracts/` defines the public frontend/backend API boundary.

It holds zod schemas, enums, and API contract-shape types describing request and
response shape. Runtime logic — calculations, formatting, transformations — does not
belong there, even when both sides need it.

Public API shape and physical database shape are intentionally separate.

### Shared Runtime Layer

`shared/` holds runtime logic that both the frontend and the backend must execute
identically, such as money calculation applied to a form preview and again to the
value written to storage.

Duplicating such logic across `src/` and `server/` lets the two copies diverge
silently, so a single implementation is imported by both.

Backend code imports it with a relative path and an explicit `.js` extension, the same
way it imports `contracts/`.

Only add code here when both runtimes genuinely need it. One-sided code stays in
`server/shared/` or `src/shared/`.

### The Three Shared Folders

| Folder | Owner | Imported by |
|---|---|---|
| `src/shared/` | Frontend only | Frontend, via `@/shared/…` |
| `server/shared/` | Backend only | Backend, via relative `.js` |
| `shared/` | Both runtimes | Frontend via `@shared/…`, backend via relative `.js` |

The names repeat, so read the import path rather than the folder name: `@/shared/x`
and `@shared/x` are different files.

## Dependency Direction

Gateway
→ Routing
→ Module
→ Persistence
→ Google Sheets

Modules
→ Contracts
→ Shared Runtime

Persistence must not depend on business modules or frontend concerns.

`shared/` and `contracts/` must not depend on `server/`, `api/`, or `src/`.

## Related Documentation

- `module-structure.md` — internal structure of backend modules
- `persistence.md` — sheet contracts and repositories
- `service-layer.md` — routes, services, and DB-to-API mapping

Route registration lives in `server/api/route-registry.ts`: each key is the URL segment and each value is a lazy `import()` of the module's exported routes.
