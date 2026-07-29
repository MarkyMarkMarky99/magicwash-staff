# Handoff — staff invoice creation

**Author:** Claude Opus 5, via Claude Code
**Date:** 2026-07-29
**Branch:** `feature/invoice-write-contract` — **nothing is committed.** Everything below is in the
working tree.
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
| Live write to both sheets | **Proven twice** — see below |
| Frontend | **Not started.** Do not start it alone. |
| Prototype | `docs/prototypes/invoice-create.html` — built before the flow changed, so it is stale |

## Proven against the live sheets

Two real invoices were written end to end through the real service and the real gateway:

```
INV-PROBE-247494   itemsTotal 866.8   invoiceTotal 823.4599999999999   ← before the rounding fix
INV-PROBE-528466   itemsTotal 866.8   invoiceTotal 823.46             ← after
```

Both wrote 3 item rows plus an invoice row. An `UPDATE` by `invoice_number` came back
`row_number: 2`, confirming the header row is really in the sheet.

**Clean-up owed:** those two invoices and their six item rows are sitting in the production
`Invoices` / `InvoiceItems` tabs. The gateway's `DELETE` is a soft delete, so removing them for real
means editing the spreadsheet by hand.

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

1. **The prototype is stale.** `docs/prompts/invoice-create-prototype.md` is current — two screens,
   no billing type, order items auto-loaded on pick, compact line rows, real design tokens copied
   from `src/style.css`. The HTML in `docs/prototypes/` was built before those changes. Rebuild it
   from the prompt before showing anyone.
2. **Then build the frontend with the product owner, not ahead of him.** He has twice corrected
   work that ran past its brief. The layering rule is firm: behaviour in `src/services/`,
   orchestration in `src/pages/`, and `src/components/` renders props and nothing else.
3. Delete `src/components/forms/CreateInvoiceForm.vue` and its `FormOverlayPage.vue` entry, and
   `src/features/invoices/types/invoices.types.ts` — that types file uses `UNPAID`/`PAID` in the
   status field, which the live schema rejects outright.
4. `src/features/invoices/services/invoice.service.ts` calls `/api/modules/invoices`. That route
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
