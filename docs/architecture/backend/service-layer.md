---
last_audited: 2026-08-26
audit_sources:
  - server/shared/services/base-crud.service.ts
  - server/shared/http/crud-routes.ts
  - server/modules/customers/customer.module.ts
  - server/modules/invoices/invoice.module.ts
  - server/modules/invoices/invoice.service.ts
  - api/CLAUDE.md
  - server/modules/appointments/appointment.service.ts
  - server/modules/customer-packages/package-transaction.service.ts
---

# Backend Service Layer

The service layer sits between routes and sheet repositories.

It validates requests, maps database rows to API DTOs, and owns multi-sheet write orchestration.

## Structure

Route (`createCrudRoutes`, or a hand-rolled `ApiHandler`)
→ Service (`BaseCrudService`, or a named class)
→ Sheet Repository (`SheetRepositoryContract`)

Most modules instantiate `BaseCrudService` directly in their `<feature>.module.ts`.

A named service class is used when a module needs something `BaseCrudService` doesn't provide — multi-sheet write orchestration (`InvoiceService`, `PackageTransactionService`) or single-sheet custom write policy (`AppointmentService`).

## Responsibilities

Routes in `server/shared/http/crud-routes.ts` handle HTTP transport only.

`GET` collection calls `service.list`, `POST` calls `service.create`, `GET` item calls `service.getById`, and `PATCH` calls `service.update`.

Invoice routes are hand-rolled in `server/modules/invoices/invoice.module.ts` because `create` returns a six-outcome union and `list` has a date-range bypass.

`BaseCrudService` in `server/shared/services/base-crud.service.ts` validates requests against the module's `ModuleApiContract`.

It applies `fieldMap` and `jsonColumns` to map database rows to API DTOs and projects responses to `api.response.*.shape`.

Named services orchestrate writes that span more than one sheet.

`InvoiceService` in `server/modules/invoices/invoice.service.ts` writes `Invoices`, `InvoiceItems`, and `OrderForm`, then triggers an `InvoicesView` resync.

Sheet repositories use database column names only and have no public API-shape knowledge.

See `persistence.md` for the repository and contract layer.

## Placement Rule

Declare `fieldMap` and `jsonColumns` on the module or the named service that owns it (e.g. `customer.module.ts`, or `invoice.service.ts` for invoices), never on the repository.

A repository must remain reusable across any DTO shape.

Place write orchestration across multiple sheets in a named service, never in a route handler or repository.

## Related Documentation

- `persistence.md` — sheet repository and contract layer this depends on
- `module-structure.md` — where service and module files live inside a feature folder
