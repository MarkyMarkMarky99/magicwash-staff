---
last_audited: 2026-08-26
audit_sources:
  - contracts/customers/customer-api.schema.ts
  - contracts/shared/module-api-contract.ts
  - server/shared/contracts/sheet-contract.ts
  - server/shared/services/base-crud.service.ts
  - server/sheets/Customers/Customers.db-contract.ts
---

# Contract Conventions

API contracts and DB contracts represent different boundaries and must remain separate.

- [API Contracts](./api.md) — frontend/backend boundary
- [DB Contracts](./db.md) — physical Google Sheet

## Boundary

API Contract ≠ DB Contract

DB ↔ API mapping belongs to the owning backend module or service.

Do not import DB contracts into frontend code.

Do not put API field mappings inside DB contracts.

## References

- `docs/conventions/naming.md`
- `docs/architecture/backend/service-layer.md`
- `docs/architecture/backend/persistence.md`
