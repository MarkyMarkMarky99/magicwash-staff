# Next session

## Where we are

On **`main`** at `b0a3985`, pushed and live on `https://magicwash-staff.vercel.app`.
`main` push = Vercel prod deploy. Two branches still conflict (below).

Landed 2026-08-27, built as three parallel jobs in three worktrees off a frozen contract:

- **`packages` module** — CRUD API over the existing `Packages` catalog sheet
  (`GET`/`POST /api/packages`, `GET`/`PATCH /api/packages/:id`), plus `src/features/packages/`
  (list, form, store, service) for staff.
- **customer-package reads no longer touch `CustomerPackageView`.** That formula view never
  refreshed, so appended rows were invisible. List/detail are now assembled in
  `customer-package-read.service.ts` from `CustomerPackages` + `PackageTransactions` + `Packages`
  + `Customers` — 4 GViz calls, in-memory join, filter/sort/page in memory because GViz `where`
  is equality-only. Design: `docs/customer-package-view-service-assembly.md`.
- **Pickers on the create-customer-package form** — `packageCode` is a dropdown, `customerId` is a
  filterable `CustomerPicker` over the cached customer list.
- **Datetime convention written down** (`docs/conventions/datetime.md`) plus a read-side fix:
  `normalizeSheetTimestamp` used to truncate an offset-bearing ISO string, relabelling UTC as
  Bangkok, 7 hours wrong. It now converts. Legacy ISO rows in `Packages` come back in the
  project format.
- **IssueReports sheet is live** — see below.

Verified by hitting the live API, not just typecheck: all four surfaces on prod return 200, package
CRUD round-trips through the sheet (create/edit/deactivate/duplicate-reject/404), a deactivated
package is still rejected for purchase, and a newly created customer package appears immediately —
the bug that started the work.

## Do this first

1. **Smoke test through the UI in a browser.** Everything so far was proven at the API layer.
   `npm run build` is esbuild only and `.vue` files cannot be unit tested, so no frontend behaviour
   has been verified: the packages list/form pages, the package dropdown, and the customer picker
   have never been clicked. `/frontend-test` is the tool for this.
2. **Delete the leftover test data.** `ZZTEST01` in the `Packages` catalog (created by a live write
   test, deactivated but still listed), and customer package `af9f0651` for พิมพ์นิดา, which is a
   real ACTIVE GOLD 50-credit package. `SheetRepository.delete()` throws, so both must go by hand.

## Physical sheet setup — three traps no test catches

Found the hard way while wiring up IssueReports. All three must be true of any new tab, and every
one of them fails at runtime with a different error:

1. **Share → General access = "Anyone with the link" → Viewer.** Reads go through GViz
   unauthenticated; a private sheet fails every read with `GViz read failed: 401`. Editor rights for
   the service account cover writes only — writes can succeed while every read 401s.
2. **The header row must hold every contract key.** Missing one gives
   `GViz query error: Invalid query: NO_COLUMN: F`.
3. **The grid must be exactly as wide as the contract.** A fresh Google tab is 26 columns wide and
   the reader throws `No DB field resolves for GViz column 'J'` on the first column it cannot map.
   Delete the surplus. `Packages` is exactly 12 wide for its 12 fields.

`docs/scripts/create-issue-reports-sheet.gs` is a container-bound Apps Script that does 2 and 3 and
prints reminders for 1. Copy it as the template for the next sheet.

`ISSUE_REPORTS_SPREADSHEET_ID` is set in `.env.local` and in all three Vercel environments, and
`G:\My Drive\...\GoogleSheets\IssueReport.json` now exists (registry is 21 files).

## Two branches left unmerged, both conflicting

Deliberately not resolved: resolving these is code work, not a merge button.

| Branch | Conflicts |
|---|---|
| `feature/customer-create-form` | `src/App.vue` (the `KeepAlive` exclude list) |
| `feature/invoice-create-form-redesign` | `PriceListFormPage.vue`, `.user/memory/MEMORY.md` |

`feature/customer-packages-write-backend` was **deleted as superseded**, verified before deleting:
its service and db-contract files were byte-identical to main's, its `package-transaction.service.ts`
differed only in two import-path lines, its `customer-package-api.schema.ts` was 127 lines *shorter*
than main's merged one, and its three contract dry-tests are a subset of main's consolidated
182-line test. The conflicts were the already-merged contract collapse, nothing more. Do not go
looking for that work — it is all on main via `63f110c` plus the contract-merge branch.

All other branches were merged and deleted (8 local, 3 on origin). Only these two remain.

## Datetime helper consolidation — deferred on purpose

Convention is now written down in `docs/conventions/datetime.md`: one format,
`yyyy-MM-dd HH:mm:ss` Asia/Bangkok, write side and read side, and where cross-boundary code lives.

New cross-boundary datetime helpers go in root **`shared/utils/`** — the only directory both sides
import (`api/tsconfig.json` includes `../shared/**/*.ts`; frontend has the `@shared` alias). The
customer-package read-assembly job creates the first one there.

**Not migrated yet, deliberately:** `server/shared/utils/bangkok-timestamp.ts` (write side) and
`src/shared/utils/sheet-date.ts` (frontend parse/display) still hold their own implementations.
Moving the write-side helper touches `SheetRepository`, which every module depends on, so it must be
its own job on a quiet tree — doing it alongside feature work would collide with every branch in
flight. Do it after the packages/customer-package work lands, not before.

## Still open from before

- **CANCELLED vs VOID** — nothing in code, the DB contract, or the G Drive registry defines the
  difference. `invoiceStatusUpdateSchema` accepts **both**, because both already exist in the sheet
  enum: accepting both invents nothing. If the business has only one notion of "cancel", drop the
  other; the structure does not change either way.
- **`z.infer` exports in schema files** — standing rule is that schema files carry no type exports.
  `invoice-api.schema.ts` has 14. Stripping them is a pass across all contract files, not an
  invoice-only change.
- **Cancel/void UI** — deferred by the user. Design is in
  `docs/plans/invoice-contract-merge-and-status-update.md`.
- **Nested invoice+items update** — blocked, not skipped. `SheetRepository.delete()` throws, the
  Sheets client exposes only `values.*` (no `batchUpdate`/`deleteDimension`, and `SheetContract`
  stores no gid), and `InvoiceItems` has no soft-delete column. Removing a line has no
  representation today; one of those three must change first.

## Facts worth not rediscovering

- Customer-package create is **complete server-side**: route → `customerPackagePurchaseService.create`
  → read `Packages` catalog by `packageCode` (rejects retired/`deleted_at`) → append `PURCHASE`
  opening row to `PackageTransactions` → append to `CustomerPackages`. Server fills `id` (8-char)
  and `created_at`. `CustomerPackages` has **no status column** — status lives on the read-only
  `CustomerPackageView` portal sheet.
- `PATCH /api/customer-packages/:id` is a **stub that always 404s** — editing a package is
  undefined product-wise, not a bug.
- `invoiceViewResolveStatus_` (Apps Script) recomputes status **only when the stored value is
  `ISSUED`**, deriving PAID/PARTIALLY_PAID/OVERDUE/UNPAID from payments. DRAFT/CANCELLED/VOID pass
  through — that is why a status PATCH survives a re-sync.
- Apps Script is **not** retired: `APPSCRIPT_INVOICE_VIEW_SYNC_URL` and `src/api/photos.js` are still
  live. Row writes moved to Sheets API v4 with a service account; **reads are still unauthenticated
  GViz**.
- `npm run build` is esbuild only — **no frontend type-check exists**. A broken prop contract ships
  green. Only `typecheck:api` type-checks anything.
- `.vue` SFCs **cannot be unit tested** here; tests are plain TS run with `npx tsx`. "No automated
  test was possible" is the correct report for a component change, not a gap to paper over.
