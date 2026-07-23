# Design Notes: Building a Complex (Multi-Sheet) Module

**Date:** 2026-07-24
**Status:** Research/design notes only — no code written
**Scope:** `server/modules/` backend architecture — how to add a module that spans more
than one Google Sheet (e.g. a future `invoices` module: `Invoices` + `InvoiceItems` +
`PaymentSummary` + `Payments`), since today's real modules (`appointments`, `customers`,
`orders`) are all single-sheet.
**Method:** Direct code reading (`api/CLAUDE.md`, `server/shared/*`,
`server/modules/appointments/*`) + two `codex-explorer` research passes, both
cross-verified against source before being trusted.

## Question this answers

`api/CLAUDE.md` documents a "simple module" recipe in detail (contract + module wired
through `GSheetRepository` + `BaseCrudService` + `createCrudRoutes()`), and names
"complex modules" (multi-sheet reads, 1:n assembly, business rules beyond CRUD+filter) as
keeping dedicated `types/ queries/ repositories/ mappers/ services/` layers — but doesn't
show a worked example or say how those layers plug into the generic gateway/registry
machinery. This doc fills that gap.

## The current engine is hard-wired to one sheet

- `GSheetRepository` (`server/shared/repositories/gsheet.repository.ts:96`) takes exactly
  one `sheetName`/`spreadsheetId`/row contract in its constructor. One instance = one sheet.
- `BaseRepository` (`server/shared/repositories/base.repository.ts:114`) is generic over a
  single `TApiRow`/one primary key/one field map. Its only extension point is the
  `RepositoryTransformer.request`/`.response` escape hatch, which reshapes data flowing
  through *that one repository's* pipeline — it cannot fan a write out to a second sheet
  or join in a second read.
- `BaseCrudService` (`server/shared/services/base-crud.service.ts:104,123,141,160`) has a
  fixed validate → single-repository-call → project flow for `list/getById/create/update`.
  Per `api/CLAUDE.md`: "No hooks in `BaseCrudService`" — by design, not an oversight.
- `appointments` is the closest thing to "beyond CRUD" in the current tree (it has a
  `.transformer.ts`), but it is **still single-sheet**: the transformer just packs flat
  customer fields into a JSON blob stored in the one `Address` column
  (`server/modules/appointments/appointment.transformer.ts:59,89`) and unpacks it on read.
  No second sheet is ever touched. Confirmed via
  `server/modules/appointments/appointment.module.ts:17` — exactly one `GSheetRepository`,
  one `BaseCrudService`.

**Conclusion:** a real multi-sheet module cannot be built by configuring the generic
engine — it needs a hand-rolled repository and service, same as `api/CLAUDE.md`'s
"complex module" folder layout implies.

## What the gateway actually requires structurally

This is the part `api/CLAUDE.md` doesn't spell out. The real contract is small:

- `server/api/route-registry.ts:3` maps a module name to a `RouteLoader`:
  `() => Promise<GatewayModuleRoutes>`.
- `GatewayModuleRoutes` (`server/shared/http/gateway.types.ts:3`) is just
  `{ collection: ApiHandler; item?: ApiHandler }`.
- `ApiHandler` (`server/shared/http/api-handler.ts:42`) is a plain
  `{ GET/POST/PATCH/...: (req: ApiHandlerRequest) => ApiResult }` method-dispatch map. It
  has **no dependency on `BaseCrudService`** — it converts thrown `ApiError`s to error
  responses and that's it.
- `createCrudRoutes()` (`server/shared/http/crud-routes.ts:16`) is one convenience
  builder of `GatewayModuleRoutes` from a `BaseCrudService` + its API contract. It is not
  the only way to produce a valid `GatewayModuleRoutes` — it's just the shortcut simple
  modules use.

**So a complex module can hand-write its own `ApiHandler`s around a hand-rolled service,
as long as the final export shape is `{ collection, item? }`.** Nothing else about the
generic engine is mandatory.

### Hard constraint found: gateway path depth

`server/shared/http/api-gateway.ts:27`:
```ts
if (segments.length === 0 || segments.length > 2) {
  throw ApiError.notFound('Route not found')
}
```
Only `/api/<module>` and `/api/<module>/<id>` are supported — **no nested paths** like
`/api/invoices/:id/payments`. Any sub-resource design must either:
- extend `api-gateway.ts` itself (shared file — affects every module, needs care), or
- model the sub-resource as its own top-level module (e.g. `/api/payments`, filtered by
  `invoiceId` as a query/body field instead of a URL segment).

## Historical precedent: the deleted invoice module

A full multi-sheet invoice backend existed once and was removed in commit `579a49d`
("Remove legacy invoice backend") during the engine migration to
`GSheetRepository`/`BaseCrudService`. Full source is still recoverable from its parent
commit `803ce3f` (e.g. `git show 803ce3f:server/modules/invoices/services/invoice.service.ts`).

Shape (confirmed by codex-explorer against git history):
- `server/modules/invoices/types/invoice-sheet.types.ts` — row types for all 4 sheets +
  aggregate list/detail shapes.
- `server/modules/invoices/repositories/invoice.repository.ts` — composed **4 separate
  `BaseSheetRepository` instances** (the old, since-deleted single-sheet repository
  class — conceptually the predecessor of today's `GSheetRepository`). Detail read loaded
  header + items + summary + payments in parallel; list read loaded `Invoices` plus a
  *batched* `PaymentSummary` lookup joined in memory (2 queries total, no N+1 — list never
  read `Payments`, so `paymentMethod` couldn't appear on the list DTO). Writes fanned out
  sequentially in dependency order and were explicitly documented as **non-atomic**
  (Google Sheets has no cross-sheet transaction).
- `server/modules/invoices/services/invoice.service.ts` — owned validation, id/number
  generation (`INV-YYYYMM-<random4>`, random suffix to dodge a Sheets race on a running
  counter), totals computation, in-memory `status` filter + pagination (applied *after*
  the join, since it depends on joined data), payment verification, and `PaymentSummary`
  recomputation (`amountPaid` counts only `VERIFIED` payments; rollup status
  PAID/PARTIAL/UNPAID; `OVERDUE` derived from an injected "today").
- `server/modules/invoices/mappers/invoice.mapper.ts` — pure functions turning
  aggregate sheet rows into the split `InvoiceListItemDto` (light) vs `InvoiceDetailDto`
  (full breakdown + items + payments) response shapes.
- Routes were direct Vercel file handlers (pre-gateway-refactor), including nested paths
  like `api/invoices/[id]/payments/[paymentId].ts` — a routing style the *current* gateway
  does not support (see path-depth constraint above), so routes cannot be copied as-is
  even though the service/mapper logic can.

**Reuse verdict:** service + mapper business logic is largely portable as-is (pure
logic, not tied to the deleted repository classes). The repository layer must be
rewritten on top of `GSheetRepository` (one instance per sheet) instead of the deleted
`BaseSheetRepository`/`GVizClient`/`AppScriptClient`. Routes must be rewritten as
hand-built `ApiHandler`s honoring the current 2-segment gateway limit.

## Recommended design for a new multi-sheet module

1. **Repository:** one `GSheetRepository` per sheet (Invoices, InvoiceItems,
   PaymentSummary, Payments), each with its own `<sheet>.contract.ts` (row schema +
   fieldMap) — this part reuses the current engine for free (GViz reads, Apps Script
   writes, column-letter derivation).
2. **Service:** a hand-rolled `InvoiceService` (does *not* extend `BaseCrudService`) that
   holds references to the per-sheet repositories internally, does in-memory joins on
   read, and issues sequential writes on create/update (accepting non-atomicity, per the
   historical precedent's documented decision). Validate with `parseOrThrow(schema,
   payload)` directly — the same helper `BaseCrudService` uses internally, just called by
   hand.
3. **Routes:** hand-built `ApiHandler`s (not `createCrudRoutes()`, since business methods
   like `recordPayment()`/`verifyPayment()` don't fit the generic CRUD slot model),
   exported as `{ collection, item }` satisfying `GatewayModuleRoutes`.
4. **Sub-resources (e.g. payments):** given the gateway's 2-segment limit, model as a
   sibling top-level module (`/api/payments`) rather than nesting under `/api/invoices/:id/...`.
   Payments itself is single-sheet, so it may be able to reuse `BaseCrudService` +
   `createCrudRoutes()` normally for its own list/create/update — except that "verify
   payment" needs to also recompute `PaymentSummary` on the Invoices side, which
   `BaseCrudService` has no hook for, so that one operation likely still needs a
   hand-written route calling into a shared service function.
5. **Registration:** add a literal dynamic import entry to `server/api/route-registry.ts`,
   same as existing modules.

## Open questions / not decided here

- Whether to extend `api-gateway.ts` to support 3+ path segments (would let
  `/invoices/:id/payments` work as a true nested route) vs. keeping the sibling-module
  design. No decision made — this doc only lays out the tradeoff.
- Live Google Sheets column layout for the 4 invoice sheets needs re-verification (the
  old memory of this design flagged column letters as "sequential guesses, unverified").
- Env vars needed: likely `INVOICES_SPREADSHEET_ID` (+ per-sheet name vars) alongside the
  existing shared `APPSCRIPT_URL`, following the pattern in `api/CLAUDE.md`'s Environment
  Variables section.
