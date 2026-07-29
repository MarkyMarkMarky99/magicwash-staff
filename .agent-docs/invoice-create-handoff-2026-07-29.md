# Handoff — staff invoice creation

**Author:** Claude Opus 5, via Claude Code
**Date:** 2026-07-29, updated same day, multiple passes — this is the current version.
**Branch:** `feature/invoice-write-contract`, up to commit `bf39325`. The view-sync work lives in
`appscript/MagicwashPortal` — a **separate repo**, already pushed and deployed live — see below.
**Originating session:** `38aaa679-80d9-4e77-99c9-f87753758023` (ran from
`C:\MagicwashGemini\webapp-react`, not this repo). To ask it something:

```bash
claude --resume 38aaa679-80d9-4e77-99c9-f87753758023 --model haiku
```

---

## What this is

Staff open an order from a customer's order history, tap "Create Invoice," land on a form
pre-filled from that order, price the lines, and submit. The whole path — frontend, backend, and
the three sheet writes it triggers — **is built and has created real invoices against the live
sheets.** Read `.claude/agents/invoice-builder.md` first; it carries the schema rules and gateway
facts that were expensive to discover, and `subagent_type: invoice-builder` gives you an agent
already primed with it (note: this custom agent type may not be registered mid-session — if
`Agent` rejects it, brief a plain `claude` agent to read that file first instead).

## Where things stand

| Piece | State |
|---|---|
| Contracts (prose + Zod, both sides) | Done |
| Shared arithmetic (`invoice-calculator.ts`) | Done, with dry tests, rounding verified live |
| Backend: write `Invoice` + `InvoiceItem` | Done, proven live many times |
| Backend: mark `OrderForm.invoice_id` (3rd write) | Done, proven live |
| `InvoiceView.json` schema + rebuild endpoint (Apps Script) | Done, deployed, proven live |
| Wiring the view rebuild into `createInvoice()` | **Still not done** — see Next session |
| Frontend: order history → create → submit → result | **Done and has created a real invoice** |
| `docs/prototypes/invoice-create.html` | Stale (predates the current flow); ignorable now |

## The real thing has worked, end to end, through the actual UI

`INV260753193107` was created through the actual browser flow (not a script): order `b7d4b1fc`,
customer `281cdc9a` (Amanah Bangkok), one line, `itemsTotal`/`invoiceTotal` both `400`. All three
writes succeeded (`kind: "created"`) and it has been synced into `InvoicesView` (`status: UNPAID`,
`grandTotal 400`). This, plus everything in "Proven against the live sheets" below, means the
create flow is not theoretical — it is doing its job on production data right now.

**Clean-up owed:** several `INV-PROBE-*` test invoices (see below) plus `INV260753193107` itself
(a real submission made while debugging, harmless but not a genuine business invoice) are sitting
in `Invoices`/`InvoiceItems`/`InvoicesView`. The gateway's `DELETE` is a soft delete; removing rows
for real means editing the spreadsheets by hand.

## The frontend, as built

- **Entry point**: `OrderDetailSheet.vue` (customers feature) has a third button, "Create Invoice,"
  next to View Photos / Book Delivery. It calls `useSelectedCustomerStore().select(customer)` then
  `useInvoiceCreateIntentStore().set(order)` then navigates — copying the exact Book Delivery
  handoff pattern (`src/shared/stores/delivery-booking-intent.store.ts`).
- **`src/shared/stores/invoice-create-intent.store.ts`** — holds the **whole order object**
  (already carries `items[]`; there is no per-order detail endpoint to re-fetch from), consumed
  exactly once via `consume()` (read + clear atomically), same contract as the delivery-booking
  store.
- **`InvoiceCreatePage.vue`** — owns all state. Uses `onActivated`, not `onMounted` (fixed in
  `bf39325`, after `onMounted`-only left stale state behind when the page is kept alive by the
  router and revisited) — every re-entry re-consumes the intent and resets the form fresh.
  - `invoiceNumber` is **pre-filled** with `INV` + 2-digit year + 2-digit month + 8 random digits,
    but stays a **plain editable text input** — staff can overwrite it entirely, and the server
    treats whatever ends up there as an opaque, verbatim string. This was a deliberate reversal
    mid-session: the original decision was "staff types it with no default," changed to "suggest
    one, but still editable" — if this surprises a future reader, it is intentional, not scope
    creep.
  - Order items pre-fill `description`/`quantity` (from `order.items`); `unit` best-effort from
    `serviceType`; **`unitPrice` is always left blank** — orders carry no price data, staff price
    every line regardless of where it came from.
  - Per-line and invoice-level adjustment editors, a live totals preview (imports
    `computeInvoiceLine`/`computeInvoiceTotal` from `contracts/`, never reimplements them).
  - All **five** response kinds get distinct screens. `items_write_failed` and `validation_error`
    allow retry (`canRetry` computed). `invoice_write_failed` and `order_link_failed` explicitly
    refuse one — both mean the invoice already exists by the time they fire, and a retry would
    duplicate line items or bill the order twice. `order_link_failed` is framed as good news with
    a loose end (the money is correct; only `OrderForm.invoice_id` didn't get set), not a failed
    sale.
  - A **dev-only JSON panel** (`InvoiceDevJsonPanel.vue`) renders the live request payload and, post
    -submit, the raw response. Its file's first line is an explicit `<!-- DEV ONLY -->` marker —
    delete that one file plus its one import/usage before shipping.
- **Deleted**: `src/components/forms/CreateInvoiceForm.vue` (stale shape, dead submit handler) and
  its `FormOverlayPage.vue` entry. **Kept, deliberately**: `src/features/invoices/types/
  invoices.types.ts` — 8 files in the pre-existing, already-broken invoice list/detail feature
  depend on it (that feature calls a route that was never implemented server-side, unrelated to
  this work). The new create flow imports types from the contract directly and never touches the
  forbidden `UNPAID`/`PAID` enum that file uses.
- **Fixed in the same pass, because this change broke them**: `AppHeader.vue`'s "+" button on
  `/invoices` pointed at the now-deleted form route; a back button for `/invoices/create` didn't
  exist. `invoice.service.ts` called `/api/modules/invoices`, a route that never existed — fixed to
  the real `/api/invoices`.

## A real bug found and fixed while testing this: silent error swallowing

`ApiHandler.handleRequest` (`server/shared/http/api-handler.ts`) caught every thrown error from a
hand-rolled route and replaced it with a generic `{success:false, error:{code:"INTERNAL_ERROR",...}}`
body — **without logging the original error anywhere**, unlike the outer `ApiGateway`, which does
log. A real, valid invoice submission got misdiagnosed as a payload bug for a while, because the
only visible symptom was that generic body with zero information behind it. Fixed in `003c3b8`:
the handler now `console.error`s the real error before replacing it. If you're staring at another
opaque 500 from this app, check the terminal running `vercel dev` now — it will actually say why.

**The specific bug that generic message was hiding, that day**: `vercel dev` was running with a
process environment from before `APPSCRIPT_GATEWAY_URL` was added to `.env.local` — Node reads env
files once at process start, not on every request. **Restarting `vercel dev` after any `.env.local`
change is required**; this will keep happening otherwise.

## Proven against the live sheets (chronological, illustrative — not exhaustive)

```
INV-PROBE-247494       866.8 / 823.4599999999999   ← before the invoice-level rounding fix
INV-PROBE-528466       866.8 / 823.46              ← after
INV-PROBE-473405       866.8 / 823.46              ← used for the view-sync live test
INV-PROBE-CASE1/2/3-*  three shapes: no adjustments; mixed item+invoice adjustments;
                       back-dated + positive surcharge — all matched hand-computed expectations
INV260753193107        400 / 400  ← the first real submission through the actual browser UI
```

## InvoicesView — a separate rebuild-on-demand endpoint, in Apps Script

The Node backend does **not** assemble the `InvoicesView` row itself. That logic lives in the Apps
Script project that owns the sheet, as a `doPost` endpoint callable after *any* write that should
affect the view (new invoice, new payment, status change) — not wired into `createInvoice()` yet
(see Next session #1).

- **Schema**: `G:\My Drive\Magicwash\Database\GoogleSheets\InvoiceView.json` — the first schema
  file ever written for a portal view. `customerJson`/`itemsJson`/`adjustmentsJson`/`paymentsJson`
  are pre-serialized strings (same convention as `Payment.slip_data`), not nested objects.
- **Implementation**: `appscript/MagicwashPortal/InvoiceViewSync.js`, one file. Reads `Invoices` +
  `InvoiceItems` + `Payments` by header name (never column position), resolves `status`, computes
  `subtotal`/`grandTotal`/`paidAmount`/`balanceDue`, upserts one row. Deliberately never touches
  `Customers` — `customerJson` is the frozen `Invoices.customer` snapshot, re-keyed to camelCase.
- **`paidAmount` counts only `Payment.status === 'VERIFIED'`** rows; `PENDING`/`FAILED`/`CANCELLED`
  are excluded from the money total but still appear in `paymentsJson`.
- **Rounding now matches the Node side exactly** — round after *every* adjustment step, not once at
  the end. The two independently computed the invoice-level rollup and disagreed by a cent
  whenever an invoice had two or more invoice-level adjustments; fixed and redeployed.
- **`paymentsJson` is sorted by `created_at`** — wasn't, at first; `InvoiceView.json` promised an
  order the code didn't actually produce.
- **Live URL** (current, after two redeploys for the fixes above):
  ```
  https://script.google.com/macros/s/AKfycbwjbDwnGmbom_wFA562JWQ9jLnVevGNhbRpht6N_qcHtYAnZjb4zDa4W8M-wGTGnq6w/exec
  ```
  In both `.env.local` files as `APPSCRIPT_INVOICE_VIEW_SYNC_URL`. The Script Property
  `INVOICES_SPREADSHEET_ID` this endpoint needs is already set in that Apps Script project.
- **Leftover, not mine**: `AddFN.js` in that project — a one-off script the product owner ran once
  to hand-append a real invoice row, then forgot to delete. Harmless (duplicate top-level `var`
  across Apps Script files doesn't throw), unrelated to this feature. Delete if asked.

## The design, and why

- **Create only.** No edit path. A future privileged role may change a narrow set of fields
  (`status` above all) through its **own** endpoint and contract — never a widened version of this
  one.
- **ORDER billing only.** No `billingType` in the request at all; the server writes
  `billing_type: 'ORDER'` and omits the billing-period columns. CYCLE is a later feature that adds
  a field back, not a reshape.
- **`sourceOrderId` lives at invoice level, once** — one ORDER invoice bills exactly one order, so
  the server fans it out onto every item row's `source_order_id`. Line items carry no
  `sourceOrderId`/`sourceItemId`/`serviceType` — the server writes null for the latter two. A line
  traces back to the order, not to the individual order item that produced it. Accepted for now.
- **Three writes, in order, each one load-bearing for what a mid-way failure leaves behind:**
  1. `InvoiceItem` — one batched `APPEND` (Apps Script validates the whole batch before writing any
     of it — never a loop).
  2. `Invoice` — one row.
  3. `OrderForm.invoice_id` — one `UPDATE`, keyed on the order's `id` (same value as
     `sourceOrderId`). The column is named `invoice_id`, **not** `invoice_number` — a naming
     mismatch worth remembering, the value stored is still the invoice number string. This also
     closes a real gap: it's the only way anything can tell an order already has an invoice, since
     nothing about that exists anywhere else in this system.
- **Five response kinds, kept distinct on purpose** — the difference between them is what's already
  been written, which decides whether a retry is safe:
  - `validation_error`, `items_write_failed` — nothing written, safe to retry.
  - `invoice_write_failed` — items exist, the invoice header doesn't. No retry (would duplicate
    the items).
  - `order_link_failed` — items AND the invoice header both exist; only the `OrderForm` link
    failed. No retry (would bill the order twice). An admin resolves it by hand using the
    `invoiceNumber`/`sourceOrderId` the response carries.
  - `created` — all three writes succeeded.
- **The server computes every total.** The client sends no `subtotal`, `netTotal`, `itemNo`,
  `status`, `createdBy`, `customerId` (derived from `customer.customerCode`), or `sku`.
- **One implementation of the arithmetic**, in `contracts/invoices/invoice-calculator.ts`, imported
  by both the Node backend (authoritative) and the frontend (live preview only) — a deliberate
  exception to "no logic in contracts/," because the alternative was this exact formula written
  twice and drifting apart (which is exactly what happened on the Apps Script side — see above).

## Facts about the gateway you should not have to rediscover

All verified by reading `appscript/SheetLib/` and by live calls, not assumed:

- Envelope: `{ resource: 'sheet', action: 'APPEND'|'UPDATE', target, data }` → `{ status: 'ok', ... }`,
  posted `text/plain` (Apps Script rejects the JSON preflight), following redirects. **Every
  response is HTTP 200, including errors** — dispatch on `status`, never the HTTP code.
- **Not** the envelope `GSheetRepository` speaks (`{ action, sheet, data }` → `{ success }`) — a
  different deployment. Don't reuse that repository for these targets.
- `APPEND` accepts an array and **validates every document before writing any of them** — one bad
  row aborts the whole batch, nothing is written.
- Nested values are `JSON.stringify`'d for us — send `customer`/`adjustments` as real
  objects/arrays; pre-stringifying double-encodes.
- `null` and `undefined` both produce an empty cell. Standing rule: **omit** optional columns
  rather than send null.
- `created_at`/`updated_at` are auto-stamped when absent. `created_by`/`updated_by` are **not**,
  and must be sent explicitly on every write, including the `OrderForm` `UPDATE`.
- **Writes work; reads do not**, for the `Invoices` workbook. A gateway GET on `Invoice` fails with
  `Expected property name or '}' in JSON at position 1` — that means "cannot read the sheet," not
  "bad schema." Reads for this data come from `InvoicesView`, in the **portal** spreadsheet (same
  workbook as `OrdersView`), which is publicly readable.
- `spreadsheetIdProp` in a schema names an Apps Script Script Property, resolved gateway-side —
  already set for this workbook (`Payment` uses the same one and writes succeed).
- `OrderForm`'s Drive-schema target key is exactly `OrderForm` (matches the filename); its `id`
  column is the same identifier as `OrdersView.orderId`/`sourceOrderId` throughout this chain.

## The arithmetic, and where it rounds

Item adjustments apply **per unit**, in array order, then the result × quantity. Invoice
adjustments apply **once** to the running invoice total. Same shape, same name, different maths —
the single most likely thing to be reimplemented wrong (it was, once, on the Apps Script side).

```
unitPrice 50,  quantity 10, [FIXED -10]                 → 400      (not 490)
unitPrice 100, quantity 4,  [FIXED -12, PERCENT -10]    → 316.8
those two plus a plain 150 line, invoice PERCENT -5     → 866.8 → 823.46
```

Rounding: not inside the item adjustment loop (a PERCENT step must compound on the exact prior
value); once after that loop, before multiplying by quantity; once each on `subtotal`/`netTotal`
(written to the sheet); at every step of the invoice-level loop (each intermediate there is already
a money amount); once on `itemsTotal` in the API response (a plain float sum of rounded numbers can
itself drift). `tests/contracts/invoices/invoice-calculator.dry-test.ts` pins all of it with exact
equality, including a case built specifically to demonstrate that drift.

## Open decisions / known gaps

- **Invoice number duplicate check is unimplemented.** `invoiceNumberCheckResultSchema` exists in
  the contract for it; no route or frontend wiring exists yet. The gateway enforces no uniqueness
  on `invoice_number` at all — a duplicate silently appends a second row. The agreed design (client
  -side, debounced, against `InvoicesView`, warn-never-block) is still just a plan.
  - **Corollary you should sanity-check before trusting the pre-filled invoice number blindly**:
    with only 8 random digits and a 2-digit year+month prefix, collisions are unlikely but not
    impossible, and nothing currently guards against one.
- **`created_by` is the literal `'staff'`**, one named constant (`INVOICE_CREATED_BY`, reused for
  the `OrderForm` `updated_by` too), until this app has real staff identity.
- **Customer billing fields** (`tax_id`, `branch_code`, `contact_name`, `email`) are omitted
  entirely — no source, not on the form.
- **Unit prices are typed by staff on every line**, including order-derived ones — orders carry no
  price data.
- **IDs generated by this backend are 8-character UUID segments.** One standard, everywhere.
- A 15s gateway timeout and the specific HTTP status codes for the write-failure kinds were picked
  by an agent, not reviewed against real gateway latency. The sibling `Payment` gateway has been
  observed taking **over 20s** while still writing successfully — 15s is probably too tight.

## Next session

1. **Wire the `InvoicesView` rebuild into `createInvoice()`** as an actual fourth step (today it's
   a manual call to `APPSCRIPT_INVOICE_VIEW_SYNC_URL`, done by hand for every real invoice tested so
   far). Decide what a failure here means for the response contract — the money and the order link
   are both already correct by this point, only the view is stale.
2. **Build the invoice number duplicate check** (client-side, debounced, warn-only) — the schema
   for it already exists and is unused.
3. **Clean up the test data** listed above from `Invoices`, `InvoiceItems`, and `InvoicesView`.
4. **Delete the dev JSON panel** (`InvoiceDevJsonPanel.vue` + its one usage in
   `InvoiceCreatePage.vue`) before this ships past internal testing — it is explicitly marked for
   that in its own first line.
5. `docs/prototypes/invoice-create.html` is fully superseded by the real thing now; safe to delete
   or ignore.

## Commands

```bash
npm run dev            # SPA only
vercel dev             # needed for /api/* — RESTART after any .env.local change
npm run typecheck:api
npx tsx tests/contracts/invoices/invoice-calculator.dry-test.ts
```

No lint script, no frontend typecheck. Backend imports need explicit **`.js`** extensions — a
missing one once caused a production outage, and `typecheck:api` will not catch it.
