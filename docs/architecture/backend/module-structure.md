---
last_audited: 2026-08-26
audit_sources:
  - server/modules/customers/customer.module.ts
  - server/modules/invoices/invoice.module.ts
  - server/modules/invoices/invoice.service.ts
  - server/modules/invoices/invoice-view-sync-client.ts
---

# Backend Module Structure

Business functionality is organized into modules.

Each module owns business behavior, API-to-database mapping, service orchestration, and route wiring for one backend capability.

## Structure

server/modules/<module>/
├── *.module.ts    # Module composition and route wiring
├── *.service.ts   # Business logic and complex workflows
├── *.query.ts     # Module-specific queries when needed
├── *.mapper.ts    # Explicit mapping when complexity requires it
└── *-client.ts    # Module-owned external integration clients

A simple module may contain only `*.module.ts`.

Add supporting files only when the module actually needs them.

## Dependency Direction

Route
→ Service
→ Sheet Repository

Module
→ Public API Contract

The module owns translation between the public API model and persistence model.

## Placement Rule

Keep module-specific logic inside its owning module.

Move code to `server/shared/` only when it is genuinely reusable across multiple modules.

Move it to the repository-root `shared/` instead when the frontend must execute the same
logic — a calculation whose result the UI previews and the backend stores. Two copies of
one rule diverge silently.

`server/shared/` is backend-only; root `shared/` is the only folder both runtimes import.

Do not create layers merely for structural consistency.