---
last_audited: 2026-08-26
audit_sources:
  - api/[...path].ts
  - server/api/route-registry.ts
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

contracts/      # Public frontend/backend API contracts

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

### Contract Layer

`contracts/` defines the public frontend/backend API boundary.

Public API shape and physical database shape are intentionally separate.

## Dependency Direction

Gateway
→ Routing
→ Module
→ Persistence
→ Google Sheets

Modules
→ Contracts

Persistence must not depend on business modules or frontend concerns.

## Related Documentation

- `module-structure.md` — internal structure of backend modules
- `persistence.md` — sheet contracts and repositories
- `api-routing.md` — gateway and route registry
- `data-flow.md` — backend request and response flow