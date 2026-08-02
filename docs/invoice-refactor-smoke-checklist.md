# Invoice Refactor — Dev/Preview Smoke Checklist

Status: **required before merge**. This is Layer 6 of
`docs/invoice-module-refactor-plan.md`'s Workflow Test Plan — a manual
checklist, not an automated test. Layers 1–5 (`tests/server/workflows/invoices/`,
`tests/frontend/invoices/invoice-api-compat.workflow.dry-test.ts`) cover
everything that can run against fakes/mocked `fetch`; this layer is the one
pass that talks to a real Apps Script deployment and a real, isolated
workbook. Do not substitute a dry test for this checklist.

## Prerequisites

- **Redeploy `appscript/SheetLib` (a new version of the `SheetLib` library
  MagicwashGateway binds to) before running this checklist.** `SheetService.js`
  was edited (fix round 2) so a persisted-row read-back failure AFTER a
  successful `Values.append`/`Values.batchUpdate` returns
  `{status:'ok', data:null, read_back_failed:true, reason}` instead of
  throwing out to `{status:'error'}` — previously indistinguishable from a
  pre-write validation rejection, which made a definitely-persisted batch
  look safe to retry (and would have doubled every line item on retry).
  **This source edit is INERT until a new SheetLib version is pushed/deployed
  and MagicwashGateway is repointed at it** — that redeploy was deliberately
  NOT done as part of this fix (Apps Script deploys are the user's call). Do
  not run the read-back-failure row in the table below, or trust its
  certainty classification, against an undeployed SheetLib version.
  `node appscript/SheetLib/test-sheet-lib.js` (105 tests, run locally) is the
  only verification this fix has had so far.
- An **isolated** workbook for `Invoice`/`InvoiceItem`/`Payment` — never the
  shared/production-like workbook. DELETE is unsupported anywhere in this
  flow, so any row created here is permanent until removed by hand.
- A dedicated Apps Script deployment (or a Development deployment of the real
  `MagicwashGateway`/`SheetLib`) reachable at the `APPSCRIPT_URL` this
  environment uses.
- Every environment variable in the table below actually set for the
  environment under test (see this fix round's report for exactly which ones
  are currently missing in `.env.local` — do not guess values; get them from
  whoever owns the Apps Script deployment and Vercel project).
- A real order to create an invoice against, reachable through the normal
  "Create Invoice" entry point from an order's history.
- A unique invoice number for this run, e.g. `E2E-<run-id>` (a timestamp or
  short random suffix), so a rerun never collides with a previous smoke run's
  row.

## Steps

1. Open an actual order and start Create Invoice from its order history.
2. Verify the customer and order context prefill correctly (customer name,
   code, phone/address if present; order id).
3. Edit at least two line items (description, quantity, unit price) and add
   at least one item-level adjustment and one invoice-level adjustment.
4. Confirm the live totals preview matches hand-calculated expectations per
   `contracts/invoices/invoice-calculator.ts`'s documented arithmetic
   (item-level adjustments apply per unit before × quantity; invoice-level
   adjustments apply once to the summed total).
5. Submit with the unique `E2E-<run-id>` invoice number.
6. Verify the success result renders and the calculated total shown matches
   step 4's expectation.
7. In the isolated workbook, verify directly:
   - Every `InvoiceItem` row for this invoice exists, in the same order
     entered, with the same computed `subtotal`/`net_total`.
   - The `Invoice` header row exists with `status: ISSUED`, the correct
     customer snapshot, and the entered adjustments.
   - The source order's `OrderForm.invoice_id` now points at the new invoice
     number.
8. Verify the `InvoicesView` sync outcome: open the invoice list and detail
   pages and confirm they show the same persisted data as step 7 (same
   items, same totals, same customer). If the create response reported
   `invoice_view_sync_failed`, confirm the source data (steps 7) is still
   fully correct and that the list/detail pages are the ones showing stale
   data — not the write path.
9. Repeat steps 1–8 once through local **Vercel Dev** (`vercel dev`) with the
   same isolated environment variables.
10. Repeat steps 1–8 once through a deployed **Preview** environment with the
    same isolated environment variables. This is the step that would have
    caught the 2026-07-21 missing-`.js`-extension production outage (see
    `api/CLAUDE.md`) — `typecheck:api`/`vite build`/`vercel dev` do not catch
    that class of bug; only a real deploy does.

## Required failure-path spot checks

Run enough of these to have directly observed at least one row from each
column, not just read the code. Use the isolated workbook/deployment only.

| Scenario | How to force it | Expected UI | Expected certainty |
|---|---|---|---|
| Invalid request | Submit with a required field blank (dev tools or a temporarily broken form guard) | 422, "Fix these fields and resubmit", no write | n/a (`validation_error`) |
| Definite InvoiceItem rejection | Submit a line item shape the gateway schema rejects (e.g. a duplicate `invoice_item_id` if reachable, or a temporarily malformed request) | "Nothing was saved" + Try again button | `rejected` |
| InvoiceItem timeout/response lost | Point `APPSCRIPT_URL` at an endpoint that accepts the request but never responds (or throttle/kill the connection after send) until the 15s SheetLib write timeout fires | "Outcome unconfirmed" — no Try again button, no "Nothing was saved" heading | `unknown` |
| InvoiceItem persisted-row read-back failure (`read_back_failed`) | Requires the SheetLib redeploy above. Force a transient `Values.get` failure right after a successful `Values.append` (e.g. briefly exceed a Sheets API quota, or a temporary edit that throws once) | Same as the row above — "Outcome unconfirmed", no Try again button | `unknown` |
| Invoice header failure | Force the `Invoice` APPEND to fail after `InvoiceItem` succeeds (e.g. temporarily misconfigure the `Invoice` target) | "Needs a person to fix this", items confirmed present in the sheet, no retry offered | either (no message field yet — see report) |
| OrderForm failure | Force the `OrderForm` UPDATE to fail after Invoice succeeds (e.g. a `sourceOrderId` that doesn't exist in `OrderForm`) | "Invoice created — one link is stale", no retry offered, invoice/items fully present | either |
| ViewSync failure | Point `APPSCRIPT_INVOICE_VIEW_SYNC_URL` at a broken/unreachable endpoint after a successful create | "Invoice created — view needs a refresh", no retry offered, source data fully present | either |

For every row above, confirm in the sheet directly whether the write
actually happened, and confirm the UI's message/retry-affordance matches
that reality — this is the concrete verification the automated layers (1–5)
cannot perform against a real deployment.

## Acceptance

- Existing successful create/list/detail behavior is unchanged.
- All public status codes and response fields remain compatible (including
  the new `certainty` field on every failure outcome).
- The four write stages (`InvoiceItem.batchAppend` → `Invoice.create` →
  `OrderForm.update` → view sync) occur once and in the required order, with
  their actually-observed sheet state matching what the UI reported.
- No step performs a GViz read-back to confirm a write.
- Dev and Preview both pass with real environment variables and isolated
  data.
- A `certainty: 'unknown'` outcome is directly observed at least once and
  confirmed to never render a retry affordance.

## Sign-off

Record here (or in the PR) who ran this checklist, against which
environment/workbook, on what date, and the `E2E-<run-id>` value(s) used —
so a reviewer can locate the rows in the isolated workbook.
