---
last_audited: 2026-08-26
audit_sources:
  - contracts/customers/customer-api.schema.ts
  - contracts/shared/module-api-contract.ts
---

# API Contracts

Location:

contracts/<feature>/<feature>-api.schema.ts

API contracts define the public frontend/backend boundary:

- query schemas
- request schemas
- response schemas
- API-facing enums

Use Zod schemas as the source of truth.

Group module schemas into:

<feature>ApiContract

using the standard `ModuleApiContract` shape.

API fields use application-facing names and must not expose physical Sheet structure.

## Boundary

API Contract ≠ DB Contract. Do not import DB contracts into frontend code.

Full boundary rules: [./README.md](./README.md)

## References

- `docs/conventions/contracts/db.md`
- `docs/conventions/naming.md`
- `docs/architecture/backend/service-layer.md`
