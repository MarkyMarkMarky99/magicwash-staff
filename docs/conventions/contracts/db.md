---
last_audited: 2026-08-26
audit_sources:
  - server/shared/contracts/sheet-contract.ts
  - server/sheets/Customers/Customers.db-contract.ts
  - server/sheets/Invoices/Invoices.db-contract.ts
  - server/sheets/PriceList/PriceList.db-contract.ts
  - api/CLAUDE.md
---

# DB Contracts

DB contracts define the physical Google Sheet backing one feature.

Location:

`server/sheets/<SheetName>/<SheetName>.db-contract.ts`

## Structure

```text
SheetContract
├── row              required   Zod row schema; key order = physical column order
├── primaryKey       required
├── sheetName        required
├── writes           required
│   ├── append       boolean, required
│   ├── update       boolean, required
│   └── delete       boolean, required
├── spreadsheetId    optional   env-var name holding the spreadsheet ID
├── valueInput       optional   per-column RAW / USER_ENTERED guard
└── audit            optional
    ├── onAppend     optional   fields auto-stamped on append
    └── onUpdate     optional   fields auto-stamped on update
```

Each contract must satisfy `SheetContract` from:

`server/shared/contracts/sheet-contract.ts`

`writes` always declares all three flags, even when false — no module today sets `delete: true`; treat that flag as effectively reserved.

## Rules

- Define every sheet as `<sheetName>DbContract satisfies SheetContract` — no exceptions exist for this today; do not add one without updating this doc.
- Declare `writes` explicitly; do not default or infer append/update/delete.
- Row schema key order must match the physical Sheet column order.
- Use physical column names exactly as stored in the Sheet — do not normalize casing.

## Boundary

API Contract ≠ DB Contract. DB ↔ API mapping belongs to the owning backend module or service.
Do not put API field mappings inside DB contracts.

Full boundary rules: [./README.md](./README.md)

## References

- `docs/conventions/contracts/README.md`
- `docs/conventions/contracts/api.md`
- `docs/conventions/naming.md`
- `docs/architecture/backend/persistence.md`
