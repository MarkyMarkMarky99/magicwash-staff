---
last_audited: 2026-08-26
audit_sources:
  - server/shared/contracts/sheet-contract.ts
  - server/sheets/Customers/Customers.db-contract.ts
  - server/sheets/Invoices/Invoices.db-contract.ts
  - server/sheets/PriceList/PriceList.db-contract.ts
---

# DB Contracts

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

API Contract ≠ DB Contract. DB ↔ API mapping belongs to the owning backend module or service.
Do not put API field mappings inside DB contracts.

Full boundary rules: [./README.md](./README.md)

## References

- `docs/conventions/contracts/api.md`
- `docs/conventions/naming.md`
- `docs/architecture/backend/persistence.md`
