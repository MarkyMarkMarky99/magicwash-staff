```md
---
last_audited: 2026-08-26
audit_sources:
  - contracts/customers/customer-api.schema.ts
  - contracts/shared/module-api-contract.ts
  - server/shared/contracts/sheet-contract.ts
  - server/shared/services/base-crud.service.ts
  - server/sheets/Customers/Customers.db-contract.ts
  - server/sheets/Invoices/Invoices.db-contract.ts
  - server/sheets/PriceList/PriceList.db-contract.ts
---

# Contract Conventions

API contracts and DB contracts represent different boundaries and must remain separate.

## API Contracts

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

## DB Contracts

Location:

server/sheets/<SheetName>/<SheetName>.db-contract.ts

DB contracts define the physical Google Sheet:

- row schema
- physical column names and order
- primary key
- sheet name
- spreadsheet environment key
- write capabilities
- persistence-specific options

The row schema must follow the physical Sheet column order.

Use physical column names exactly as stored in the Sheet.

## Boundary

API Contract ≠ DB Contract

DB ↔ API mapping belongs to the owning backend module or service.

Do not import DB contracts into frontend code.

Do not put API field mappings inside DB contracts.

## References

- `docs/conventions/naming.md`
- `docs/architecture/backend/service-layer.md`
- `docs/architecture/backend/persistence.md`
```
