# Next session

## Where we are

On **`fix/header-searchable-meta`** at `d285f95`, cut from `feature/customer-module`. Not merged,
not pushed. Six commits: header searchability (`2a596b6`), the customer-package form overlay
(`83efbd0`, `5cef96a`), and the list-page shell (`95ea154`, `5b39e8f`, `d285f95`).

Three files carry unrelated uncommitted user edits and must not be swept into a commit:
`src/features/customers/pages/CustomerListPage.vue` (add-customer button restyled to icon-only),
`.user/memory/MEMORY.md`, and the untracked `docs/design/patterns/list-pages.md`.

**Nothing here has been opened in a browser.** Three source-text dry-tests and an esbuild build are
the entire verification. `/frontend-test` is the next step before merging.

`main` is at `b0a3985`, live on `https://magicwash-staff.vercel.app`. `main` push = Vercel prod
deploy. Two branches still conflict (below).

## Header search is declared by the route, not by AppHeader (`2a596b6`)

`AppHeader` used to hold a private `SEARCHABLE_ROUTES = ['/customers','/invoices','/price-list']`
compared against `route.path`. Every new list feature therefore had to edit a **shared** component,
and forgetting it failed silently — the magnifier still rendered, it just did nothing. That cost the
user hours repeatedly. `canSearch` is now `route.meta.searchable === true`, `searchable?: boolean` is
declared on `RouteMeta` next to `parent`, and `tests/web/unit/shared/components/app-header-searchable.dry-test.ts`
asserts the path list never comes back.

**Adding search to a new list page = `meta: { searchable: true }` in that feature's own `routes.ts`.
Nothing shared gets touched.**

Two details that are load-bearing, not incidental:

- The watcher that closes the search on navigation lives in `AppHeader.vue` and watches
  **`route.path`**, never `route`/`fullPath`. The filter composables `router.replace` a new
  `keyword` query on every keystroke; watching the query would slam the bar shut mid-typing.
- `searchOpen` is a module-level ref in `useHeaderSearch.ts`, i.e. app-global. That is why the
  close-on-navigate watcher is needed at all. The unused `searchQuery` ref was deleted.

Stale references to `SEARCHABLE_ROUTES` still sit in `docs/plans/issue-reports.md` and
`docs/packages-module-design.md` — reported, not fixed, out of that job's authorized scope.

## Pagination is broken app-wide — deferred by the user, do not start it here

The user has explicitly ruled backend work out of this branch. Record only.

**No list endpoint in this project returns `total`/`totalPages`.** Every list route answers through
`okPaged` (`server/shared/http/response.ts:79-90`), which emits `{ page, perPage }` only. The full
meta schemas exist and are unused: `apiPaginationMetaSchema`/`apiPaginatedSchema`
(`contracts/shared/api.schema.ts:39-52,78-84`) and `paginatedBody` (`response.ts:31-36`).

Two things claim otherwise and are wrong: `api/CLAUDE.md:187` documents the full meta, and
`src/shared/api/api-client.ts:18-23` types it — so the frontend has a `total` field that is typed
present and is `undefined` at runtime. Fix the code or the doc, but they currently disagree.

Six modules dodge this via the cap-once path that `docs/design/patterns/list-pages.md:43-47` allows —
`perPage` is set to the schema max on the first call, so there is no page 2: customers 2000,
orders 500, issue-reports 500, packages 200, price-list 100, appointments pending/waiting-pickup 100.
Appointments **schedule** instead walks pages until a short page (`appointment.store.ts:151-174`).

Only **`invoices`** and **`customer-packages`** use the default `perPage` 20 with no pager UI, so
records past row 20 are genuinely unreachable today. Invoices hides it: `invoice.service.ts:15-26`
sets `total = items.length` and `InvoiceListPage` renders `:count="total"` — a current-page length
displayed as a collection total, the exact thing the pattern doc forbids. `customer-packages` does
the same thing unhidden with `:count="items.length"`.

Recommended when picked up, in two separately-reviewed steps because step 1 touches every module:

1. Make `okPaged` emit real `total`/`totalPages` and fix invoices' fake `total`. The actual work is
   the count query — GViz `limit`/`offset` (`gviz-query.builder.ts:96-102`) does not know the
   unpaged size, so each list request needs a second count call.
2. Then add pager UI to `invoices` and `customer-packages` only. Leave the six cap-once modules
   alone; they are compliant as they stand.

The alternative — make those two cap-once like the rest — is smaller but only defers the problem for
invoices, which grow without bound.

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

## `ListPageLayout` is now the only list-page shell (`95ea154`, `5b39e8f`, `d285f95`)

`src/shared/layouts/ListPageLayout.vue` owns the shape every list page used to hand-copy:
`AppLayout` → collapsible header search → `filters` slot (non-scrolling) → scroll `<main>`. Six pages
render through it: customers, invoices, price-list, customer-packages, packages, issue-reports.

Deliberate boundaries — do not "improve" these:

- **`ListContainer` is not inside the layout.** Pages pass it in the default slot. Absorbing it turns
  the layout into a prop dump, which is the failure this design exists to avoid.
- **The layout does not own the keyword.** It renders the input, debounces (`searchDebounceMs`,
  default 300), and emits `update:searchValue`. Each page keeps its own filter composable and query
  semantics.
- **Every prop name is generic** (`searchValue`, `showSearch`, `embedded`, …). It imports nothing
  from `src/features/` and a dry-test asserts that. If a prop would need renaming to be reused by a
  feature that does not exist yet, it does not belong here.
- **The filter row's contents are the page's business.** The layout standardizes *where* tabs/chips
  sit, not which widget fills them. Converting customer-packages' and packages' chips to
  `GenericTabs` was deliberately left undone.

`tests/web/unit/shared/layouts/list-page-layout.dry-test.ts` asserts no page declares its own
`overflow-y-auto` container. That assertion is the anti-drift guard — a new list page that
hand-rolls its own scroll region fails it.

### The boolean-prop bug that shipped through every gate (`f223ae1`)

`ListPageLayout` shipped with `showSearch?: boolean`, no default, gated as
`props.showSearch ?? props.searchValue !== undefined`. **Vue casts an absent boolean prop to
`false`, never `undefined`**, so `??` never fell through and `searchEnabled` was false on all six
pages: the header magnifier toggled its state correctly and the input row was never rendered
anywhere. Fixed by defaulting `showSearch: true` and gating with `&&`.

What matters is what did **not** catch it: `npm run build` (esbuild, no type-check) was green, both
source-text dry-tests passed, and three `frontend-team` review stages approved it. It was found in
about two minutes by clicking the button in a real browser and reading
`document.querySelectorAll('input').length`.

**Rule for this repo: a boolean prop gets an explicit default in `withDefaults` and is never gated
with `??`.** And a UI change is not verified until someone has driven it in a browser — the gates
here prove the code compiles and the file contains the right strings, nothing more.

`AppointmentSchedulePage`, `PendingAppointmentsPage`, and `CustomerOrderHistoryPage` stay out: their
structure genuinely differs and forcing them in would add props for one caller each.

**One trap this refactor hit, worth not repeating:** the first attempt hid the now-duplicate keyword
inputs inside `InvoiceFilterBar`/`CustomerPackageFilterBar` with scoped `:deep()` + `display: none`.
The inputs stayed focusable and screen-reader-visible, bound to the same state as the new header
search, behind positional `nth-child` selectors that any markup edit would break. `d285f95` deleted
the inputs properly. Cause was a brief that said "do not modify shared components" and got applied to
feature components — those two filter bars live under `src/features/`, not `src/shared/`.

## customer-packages is off-pattern — frontend-only items, still open

Audited 2026-08-28 against `docs/design/patterns/list-pages.md` and `forms.md`. Pagination is
excluded (see above); everything below is frontend-only and doable without touching the backend.

`CustomerPackageListPage.vue` + `CustomerPackageFilterBar.vue` + `CustomerPackageListCards.vue`:

- Search is a permanently visible field in the filter bar instead of `useHeaderSearch` +
  `meta.searchable`. The list route declares no `meta` at all, unlike its three peers.
- Keyword is not debounced — `router.replace` fires on every keystroke.
- Raw API enums render as-is: `ACTIVE`/`INACTIVE`/`EXPIRED`/`CANCELLED` on both chips and cards. No
  label map, no semantic badge colors.
- Filter inputs are placeholder-only with no `<label>`; row buttons have no `focus-visible`.
- `main` is missing `min-h-0 no-scrollbar w-full min-w-0`; the filter sibling has no `flex-none`.

`CustomerPackageCreatePage.vue`:

- Uses `AppLayout` + an in-page `<form>` instead of `FormOverlay`.
- Package / service day / time slot are native `<select>`s; `FormOptionGrid` and `FormLabel` unused.
- The write body is an object literal inside `submit()`, not a single `createPayload()`.
- Named `CustomerPackageCreatePage.vue` rather than `<Entity>FormPage.vue`. **If it is renamed, the
  `KeepAlive` exclude entry in `src/App.vue:18` must be updated in the same commit** — that list
  matches component names, and a silent mismatch reintroduces typed-fields-leak-between-records.

Already correct, do not "fix": it is in the `KeepAlive` exclude list, `meta.parent` on create/detail
is right, `ListContainer` owns loading/error/empty/skeleton, validity is one computed with submit
disabled while invalid or submitting, and `"" → null` normalization is done.

## `TUE` is absent from the service-day enum on purpose

`customerPackageServiceDaySchema` (`contracts/customer-packages/customer-package-api.schema.ts:31`)
is `['SUN','MON','WED','THU','FRI','SAT']`. Tuesday is the shop's closing day. Confirmed by the user
2026-08-28. **Do not "complete" this enum** — an agent auditing it will read the gap as an omission.

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

## Latest maintenance

- `CustomerListPage.vue` normalizes the nullable store error before passing it to `ListContainer`.
  Its add-customer focus ring uses `outline-solid` plus explicit width so Tailwind IntelliSense does
  not report conflicting outline utilities. `jsconfig.json` retains `baseUrl` for aliases and uses
  `ignoreDeprecations: "6.0"` to suppress its TypeScript 6 migration warning.
