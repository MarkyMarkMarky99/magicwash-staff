---
last_audited: 2026-08-26
audit_sources:
  - contracts/customers/customer-api.schema.ts
  - contracts/shared/module-api-contract.ts
  - contracts/invoices/invoice-api.schema.ts
  - api/CLAUDE.md
---

# API Contracts

API contracts define the public frontend/backend boundary for each feature.

Location:

`contracts/<feature>/<feature>-api.schema.ts`

## Structure

```text
<feature>ApiContract
├── query
│   └── list        required
├── request         optional
│   ├── create      required when request exists
│   └── update      required when request exists
└── response
    ├── list        required
    ├── detail      optional
    ├── create      optional
    └── update      optional
```

Each contract must satisfy `ModuleApiContract` from:

`contracts/shared/module-api-contract.ts`

Each `query`/`request`/`response` slot holds Zod schemas, plus any API-facing enums those schemas reference.

Field requirements inside `create` and `update` are feature-specific. Check the owning feature schema.

## Rules

- Use Zod as the contract source of truth.
- Define every feature as `<feature>ApiContract satisfies ModuleApiContract`.
- If `request` exists, include both `create` and `update`; there is no `delete` slot.
- Keep API fields application-facing; do not expose physical Sheet structure.
- Do not use `invoices` as a template; its current create-only shape is known technical debt.

## Boundary

API Contract ≠ DB Contract. DB ↔ API mapping belongs to the owning backend module or service. Do not import DB contracts into frontend code.

Full boundary rules: [./README.md](./README.md)

## References

- `docs/conventions/contracts/README.md`
- `docs/conventions/contracts/db.md`
- `docs/conventions/naming.md`
- `docs/architecture/backend/service-layer.md`