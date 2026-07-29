# Handoff — staff invoice creation

**Author:** Claude Opus 5, via Claude Code
**Date:** 2026-07-29 (updated same day — the view-sync section below is newer than the rest)
**Branch:** `feature/invoice-write-contract`, commit `8f5f9be`. The view-sync work in
`appscript/MagicwashPortal` is a **separate repo**, already pushed and deployed live — see below.
**Originating session:** `38aaa679-80d9-4e77-99c9-f87753758023` (that session ran from
`C:\MagicwashGemini\webapp-react`, not this repo). To ask it something:

```bash
claude --resume 38aaa679-80d9-4e77-99c9-f87753758023 --model haiku
```

---

## What this is

Staff use this app to issue an invoice against a customer's order. The backend is **built and
proven against the live sheets**. The frontend is **not started** — the product owner wants to
build it together, after judging a prototype.

Read `.claude/agents/invoice-builder.md` first. It is the standing brief and carries the schema
rules and gateway facts that were expensive to discover. `subagent_type: invoice-builder` gives you
an agent already primed with it.

## Where things stand

| Piece | State |
|---|---|
| Contracts (spec, prose) | Done — `docs/contracts/invoice-write.contract.ts` and `invoice-api.contract.ts` |
| Contracts (Zod) | Done — `contracts/invoices/invoice-api.schema.ts` |
| Shared arithmetic | Done — `contracts/invoices/invoice-calculator.ts`, with tests |
| Backend module | Done — `server/modules/invoices/` (contract, gateway-client, service, module) |
| Route registered | Done — `POST /api/invoices` |
| Live write to Invoice/InvoiceItem | **Proven three times** — see below |
| `InvoiceView.json` schema | Done — `G:\My Drive\Magicwash\Database\GoogleSheets\InvoiceView.json` |
| InvoicesView rebuild endpoint | **Built, deployed, proven live** — `appscript/MagicwashPortal`, see below |
| Wiring the rebuild into `invoice.service.ts` | **Not done.** Currently a separate manual call. |
| Frontend | **Not started.** Do not start it alone. |
| Prototype | `docs/prototypes/invoice-create.html` — built before the flow changed, so it is stale |

## Proven against the live sheets

Three real invoices were written end to end through the real service and the real gateway:

```
INV-PROBE-247494   itemsTotal 866.8   invoiceTotal 823.4599999999999   ← before the rounding fix
INV-PROBE-528466   itemsTotal 866.8   invoiceTotal 823.46             ← after
INV-PROBE-473405   itemsTotal 866.8   invoiceTotal 823.46             ← used for the view-sync test below
```

Each wrote 3 item rows plus an invoice row. An `UPDATE` by `invoice_number` came back
`row_number: 2`, confirming the header row is really in the sheet.

**Clean-up owed:** all three invoices, their item rows, one `Payment` row (see below), and one
`InvoicesView` row are sitting in production. The gateway's `DELETE` is a soft delete, so removing
them for real means editing the spreadsheets by hand.

## InvoicesView — now a separate rebuild-on-demand endpoint, proven live end to end

Plan changed mid-session: rather than the Node backend assembling and writing the `InvoicesView`
row itself, that logic lives in Apps Script, in the **same project that owns the sheet**, callable
after *any* write that should affect the view — a new invoice, a new payment, a status change —
not just invoice creation.

- **Schema**: `G:\My Drive\Magicwash\Database\GoogleSheets\InvoiceView.json` — the first schema file
  ever written for a portal view (`OrdersView` has none). `customerJson`/`itemsJson`/
  `adjustmentsJson`/`paymentsJson` are typed as pre-serialized strings (same convention as
  `Payment.slip_data`), not nested objects — the writer stringifies them itself.
- **Implementation**: `appscript/MagicwashPortal/InvoiceViewSync.js`, one file, `doPost(e)` taking
  `{ invoiceNumber }`. Reads `Invoices` + `InvoiceItems` + `Payments` (all three, by header name,
  never by column position), resolves `status`, computes `subtotal`/`grandTotal`/`paidAmount`/
  `balanceDue`, upserts the one matching row in `InvoicesView` (update if found, append if not).
  **Deliberately does not touch `Customers`** — `customerJson` is `Invoices.customer`, the frozen
  snapshot, re-keyed to camelCase, never re-resolved live.
- **`paidAmount` counts only `Payment.status === 'VERIFIED'`** rows. `PENDING`/`FAILED`/`CANCELLED`
  are excluded from the money total but still appear in `paymentsJson` so the customer can see a
  pending slip.
- **Deployment**: `appsscript.json` had no `webapp` block at all — that's why the first two deploy
  attempts 404'd. Added `{ "executeAs": "USER_DEPLOYING", "access": "ANYONE_ANONYMOUS" }`, same as
  `MagicwashGateway`'s manifest. Live URL:
  ```
  https://script.google.com/macros/s/AKfycbzS79I0bNK2je-iFJ8cPAznDZNuOFwkFcBdGNXnqFi2sMxtGoHvoPskP3FQRqqrxWd5/exec
  ```
  Now in both `.env.local` files as `APPSCRIPT_INVOICE_VIEW_SYNC_URL`. The Script Property
  `INVOICES_SPREADSHEET_ID` this endpoint needs has been set by hand in that project already.
- **Proven live, full chain, all three sheets**: created `INV-PROBE-473405` for real, recorded a
  real `VERIFIED` payment of 300 against it for real, then called this endpoint:
  ```json
  {"ok":true,"invoiceNumber":"INV-PROBE-473405","status":"PARTIALLY_PAID",
   "grandTotal":823.46,"paidAmount":300,"balanceDue":523.46,"action":"created"}
  ```
  Called a second time with no new data → `"action":"updated"`, same numbers — upsert confirmed, no
  duplicate row.
- **Leftover in that project, not mine**: `AddFN.js` — a one-off script the product owner ran once
  from the Apps Script editor to hand-append a real invoice (`INV2607FNPLAT1`, customer Panat
  Kittisit) directly into `InvoicesView`, then forgot to delete. It duplicates the
  `INVOICES_VIEW_HEADERS` global from `InvoicesView.js` (harmless — Apps Script's V8 runtime
  tolerates duplicate top-level `var`, all files share one execution context) but is otherwise
  unrelated to this feature. Left alone; delete it if asked.
- **`webapp-vue/.env.local` was also missing `APPSCRIPT_GATEWAY_URL` entirely** — a real gap found
  while adding the sync URL, unrelated to it. Every live test up to this point had worked only
  because the test scripts cross-loaded that value from `webapp-react`'s env files instead of this
  repo's own. Fixed — now set directly in `webapp-vue/.env.local` too, so `vercel dev` run from
  this repo will actually work.

## The design, and why

- **Create only.** No edit path. Staff may not alter an issued invoice. A future privileged role may
  change a narrow set of fields — `status` above all — and that will be its own endpoint and its own
  contract, never a widened version of this one.
- **ORDER billing only.** `billingType` and the billing-period columns do not exist in the request;
  the server writes `billing_type: 'ORDER'` and omits the period columns. CYCLE is a later feature
  that adds a field back.
- **`sourceOrderId` lives at invoice level**, once. One invoice bills exactly one order, so the
  server fans it out onto every item row. Line items carry no `sourceOrderId`, no `sourceItemId`
  and no `serviceType` — the server writes null for the last two. A line therefore traces back to
  the order but not to the individual order item. Accepted for this first version.
- **Two POSTs, items first.** All line items go in one batched `APPEND`, then the invoice row. There
  is no transaction, so ordering decides what a mid-way failure leaves behind: orphan item rows that
  nothing references (invisible, recoverable) rather than an issued invoice with no lines (visible
  to staff and billable).
- **Three failure outcomes, kept distinct.** `validation_error` and `items_write_failed` wrote
  nothing and are safe to retry. `invoice_write_failed` means the item rows **are** in the sheet —
  the UI must say so and must not offer a retry, because retrying duplicates them.
- **The server computes every total.** The client sends no `subtotal`, no `netTotal`, no `itemNo`,
  no `status`, no `createdBy`, no `customerId` (derived from `customer.customerCode`), no `sku`.
- **One implementation of the arithmetic**, in `contracts/`, imported by both sides. That is a
  deliberate exception to "no logic in contracts/" — the alternative was the same formula written
  twice and drifting apart.

## Facts about the gateway you should not have to rediscover

All verified by reading `appscript/SheetLib/` and by live calls, not assumed:

- Envelope is `{ resource: 'sheet', action: 'APPEND', target, data }` → `{ status: 'ok', ... }`,
  posted as `text/plain` (Apps Script rejects the JSON preflight), following redirects. **Every
  response is HTTP 200, including errors** — dispatch on `status`, never the HTTP code.
- This is **not** the envelope `GSheetRepository` speaks (`{ action, sheet, data }` → `{ success }`)
  and it points at a different deployment. Do not reuse that repository for these targets.
- `APPEND` accepts an array, and **validates every document before writing any of them** — a bad row
  aborts the whole batch and nothing is written.
- Nested values are `JSON.stringify`'d for us. Send `customer` as a real object and `adjustments` as
  a real array; pre-stringifying double-encodes.
- `null` and `undefined` both produce an empty cell. The standing rule is to **omit** optional
  columns rather than send null — omission says the system owns the value.
- `created_at` is auto-stamped when absent. `created_by` is not, and must be sent.
- **Writes work; reads do not.** The `Invoices` workbook is not publicly readable, so a gateway GET
  on `Invoice` fails with `Expected property name or '}' in JSON at position 1` — that error means
  "cannot read the sheet", not "bad schema". Reads come from `InvoicesView` in the **portal**
  spreadsheet, the same workbook as `OrdersView`.
- `spreadsheetIdProp` in the schemas names an Apps Script Script Property, resolved gateway-side.
  It is already set — `Payment` in the same workbook uses it and writes succeed.

## The arithmetic, and where it rounds

Item adjustments apply **per unit**, in array order, then the result is multiplied by quantity.
Invoice adjustments apply **once** to the running invoice total. Same shape, same name, different
maths — this is the single most likely thing to be reimplemented wrong.

```
unitPrice 50,  quantity 10, [FIXED -10]                 → 400      (not 490)
unitPrice 100, quantity 4,  [FIXED -12, PERCENT -10]    → 316.8
those two plus a plain 150 line, invoice PERCENT -5     → 866.8 → 823.46
```

Rounding is deliberate and documented in the calculator: not inside the item adjustment loop (a
PERCENT step must compound on the exact prior value), once after the loop before multiplying by
quantity, once each on `subtotal` and `netTotal` because those are written to the sheet, and at
every step of the invoice-level loop because each intermediate there is already a money amount.
`tests/contracts/invoices/invoice-calculator.dry-test.ts` pins all of it with exact equality.

## Open decisions

- **Invoice numbers are typed by staff**, free text, stored verbatim. It is the sheet's primary key
  and the gateway enforces no uniqueness, so a typo silently appends a second row. The only guard is
  a read of `InvoicesView`, which lags — the client checks while typing and **warns without
  blocking**, and a failed lookup must never stop an invoice being issued. Not yet implemented.
- **`created_by` is the literal `'staff'`**, in one named constant, until this app has real staff
  identity.
- **Customer billing fields** — `tax_id`, `branch_code`, `contact_name`, `email` — are omitted
  entirely. The Customers sheet has no source for them.
- **Unit prices are typed by staff on every line**, including lines pulled from an order: orders in
  this business carry no price data.
- **IDs we generate are 8-character UUID segments.** One standard, everywhere.
- Two numbers were picked by an agent, not specified: a 15 s gateway timeout, and HTTP 502 / 500 for
  the two write-failure kinds. Both are reasonable; neither was reviewed. Note the sibling `Payment`
  gateway has been observed taking **over 20 s** while still writing successfully, so 15 s is
  probably too tight.

## Next session

1. **Wire the view rebuild into `invoice.service.ts` as step 3.** Right now `createInvoice()` stops
   after writing `Invoice`, and the `InvoicesView` row was only ever produced by a manual probe call
   to `APPSCRIPT_INVOICE_VIEW_SYNC_URL`. Decide what a failure here means for the response contract
   — the money is already recorded correctly either way, only the view is stale — and whether a
   failed sync should retry, queue, or just get reported for someone to re-trigger by hand.
2. **The prototype is stale.** `docs/prompts/invoice-create-prototype.md` is current — two screens,
   no billing type, order items auto-loaded on pick, compact line rows, real design tokens copied
   from `src/style.css`. The HTML in `docs/prototypes/` was built before those changes. Rebuild it
   from the prompt before showing anyone.
3. **Then build the frontend with the product owner, not ahead of him.** He has twice corrected
   work that ran past its brief. The layering rule is firm: behaviour in `src/services/`,
   orchestration in `src/pages/`, and `src/components/` renders props and nothing else.
4. Delete `src/components/forms/CreateInvoiceForm.vue` and its `FormOverlayPage.vue` entry, and
   `src/features/invoices/types/invoices.types.ts` — that types file uses `UNPAID`/`PAID` in the
   status field, which the live schema rejects outright.
5. `src/features/invoices/services/invoice.service.ts` calls `/api/modules/invoices`. That route
   never existed; the real one is `/api/invoices`.

## Commands

```bash
npm run dev            # SPA only
vercel dev             # needed for /api/*
npm run typecheck:api
npx tsx tests/contracts/invoices/invoice-calculator.dry-test.ts
```

There is no lint script and no frontend typecheck. Backend imports need **explicit `.js`
extensions** — a missing one once caused a production outage, and `typecheck:api` will not catch it.
