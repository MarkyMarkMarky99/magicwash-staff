# Next session

## Where we are

Branch **`feat/invoice-status-update`** (cut from `chore/api-contract-cleanup`), one commit:
`244b7f4 refactor: merge invoice contracts and add status-only update`. Not merged, not pushed.

Plan doc `docs/plans/invoice-contract-merge-and-status-update.md` is still **untracked** on purpose
— decide whether it belongs in the repo or was scaffolding.

All gates verified independently (not just the pipeline's self-report): `npm run typecheck:api`,
`npm run build`, and all 9 invoice dry-tests pass.

## Two decisions waiting on the user

1. **CANCELLED vs VOID** — nothing in the code, the DB contract, or the G Drive registry defines
   the difference. The contract currently accepts **both**, chosen because both already exist in
   the sheet's enum, so accepting both invents nothing and forecloses nothing. If the business only
   has one notion of "cancel", drop the other from `invoiceStatusUpdateSchema` — the structure does
   not change either way.
2. **`z.infer` exports in schema files** — the standing rule is that schema files are pure runtime
   contracts with no type exports. `invoice-api.schema.ts` has 12, and the in-progress
   `chore/api-contract-cleanup` commit kept them. This branch **kept them and added 2 more**
   (`UpdateInvoiceRequest`, `UpdateInvoiceResponse`) to keep the diff revertible. Stripping them is
   a separate pass across all contract files, not an invoice-only change.

## Deferred, with reasons

- **Cancel/void UI** — user deferred it. The plan doc has the design (where the action sits on
  `InvoiceDetailPage.vue`, confirmation, in-flight and failure states). Note the page renders status
  in a sticky footer whose container is hard-coded `bg-primary`; the `statusStyles[].badge` classes
  are dead code, only `.icon` is read.
- **Nested invoice+items update** — blocked, not skipped. `SheetRepository.delete()` throws, the
  Sheets client exposes only `values.*` (no structural `batchUpdate`/`deleteDimension`, and
  `SheetContract` stores no gid), and `InvoiceItems` has no soft-delete column. Removing a line has
  no representation today. Any of those three would have to change first.

## Facts worth not rediscovering

- `invoiceViewResolveStatus_` (Apps Script) recomputes status **only when the stored value is
  `ISSUED`**, deriving PAID/PARTIALLY_PAID/OVERDUE/UNPAID from payments. `DRAFT`/`CANCELLED`/`VOID`
  pass through. That is why a status PATCH survives a re-sync.
- Apps Script is **not** fully retired: `APPSCRIPT_INVOICE_VIEW_SYNC_URL` (invoice view sync) and
  `src/api/photos.js` (hardcoded gallery gateway) are both still live. Row writes did move to
  Sheets API v4 with a service account; **reads are still unauthenticated GViz**.
- `writes.update` lives only in `server/sheets/Invoices/Invoices.db-contract.ts` — the G Drive
  registry does not carry it, so no registry change was needed.
- The read-side `BaseCrudService` inside `InvoiceService` cannot take the merged bundle (its
  generics were `never`); a module-local `invoiceReadContract` narrows it to query + list/detail.
- Stale references to the deleted `invoice-view-api.schema` remain in `.worktrees/grok-picker-redesign/`.
  That worktree is a separate tree and was deliberately left alone.

## Pipeline notes

The Codex pipeline could not stage its own deletion (`.git/index.lock` permission denied inside the
sandbox — a known limitation). It reported this honestly; the deletion and one comment-only edit
were staged and committed from outside. Checkpoint commits were squashed into the single commit above.
