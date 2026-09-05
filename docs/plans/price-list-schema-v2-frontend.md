# Plan: PriceList schema v2 — frontend migration

> **Step 0 is approved (Mark, 2026-09-05).** Two review rounds (grok, then codex
> gpt-5.6-terra) found two problems that cannot be fixed from the frontend at all:
> nothing allocates `itemCode` any more, and paging a sheet sorted by the non-unique
> `itemCode` can silently skip rows. Step 0 fixes both inside the price-list contract
> and module. Decisions taken: **the server mints `itemCode` again**, and **the price
> list is fetched in a single request rather than paged** — the catalogue is in the
> hundreds, so there is no reason to page it, and not paging removes the skip bug
> outright rather than mitigating it.

## Step 0 — small backend prerequisite (approved)

Three changes, all inside the price-list module and its contract. No shared code, no
other module.

### 0a. `itemCode` optional on create, forbidden on update

Commit `f0c995a` deleted `nextPriceListItemCode()` from
`server/modules/price-list/price-list.module.ts` and made `itemCode` a required create
field, because price options need the client to be able to reuse an existing code.

That was right for price options and wrong for new items: nothing now allocates a code,
so the browser would have to guess one from a list it cannot be sure is complete.

- `contracts/price-list/price-list-api.schema.ts` — `priceListBusinessFields` (`:53-75`)
  is shared by the create and update schemas, so **do not** loosen `itemCode` there.
  Build the create schema as that base with `itemCode` overridden to optional (regex
  still applies when present), and build the update schema as the base **with `itemCode`
  omitted** — today `priceListUpdateSchema` is `.partial().strict()` over a shape that
  includes `itemCode` (`:73`), so a PATCH can silently move a row to a different item,
  which the UI is supposed to forbid.
- `server/modules/price-list/price-list.module.ts` — in the `append` wrapper (`:68-75`),
  when the incoming row has no `item_code`, mint it with the restored
  `nextPriceListItemCode`, recoverable verbatim from
  `git show f0c995a^:server/modules/price-list/price-list.module.ts` (lines 153-172). It
  already reads every row there to mint `id`, so this needs no extra read.
- Tests: `price-list-writes.dry-test.ts` (supplied code written verbatim; omitted code
  minted) and `price-list-api.schema.dry-test.ts` (create accepts omitted `itemCode`;
  **update rejects `itemCode`**).

**Honest limitation — do not describe this as race-free.** Read-then-append over Sheets
has no cross-request lock (`server/shared/repositories/sheet.repository.ts:158-187`), so
two people creating a *new* item in the same moment can still mint the same code. What
Step 0 removes is the much likelier failure — a browser guessing from a list it never
had in full. The residual race needs two simultaneous new-item creates, and its
consequence is two products sharing a code, which is editable after the fact rather than
data loss. **Mark: this is the risk you are accepting.** Building a real allocator or
lock on top of Google Sheets is out of proportion to this app; say so if you disagree and
it becomes its own task.

### 0b. Raise the price-list `perPage` cap so the catalogue is fetched in ONE request

The skip bug exists only because the catalogue is fetched across several requests.
Paging is `order by <column>` + `limit/offset`
(`server/shared/repositories/utils/gviz-query.builder.ts:96-104`) sorted on `itemCode`,
which is deliberately non-unique; rows tied on it are not guaranteed to hold their
relative order between two separate requests, so a walk can return one row twice and
**skip another entirely**, silently. Sorting by a unique key would fix that — but the
catalogue is in the low hundreds, so the simpler answer is not to page it at all.

- `contracts/price-list/price-list-api.schema.ts:29` — change
  `perPage: …max(100)…` to `…max(1000)…`. The cap is local to this schema, not shared;
  `contracts/packages/package-api.schema.ts:23` already uses `.max(200)`, so a
  per-module cap is the established pattern here. Leave `API_PAGINATION_DEFAULTS` and
  every other module alone.

One request, one `order by … limit 1000 offset 0`, no cross-request ordering, no skips,
no dedupe, no page loop. 79 rows today.

Do **not** add a tiebreak inside
`server/shared/repositories/utils/gviz-query.builder.ts` — that builder is shared by
every module, and changing it to serve this one is exactly the kind of shared-rule edit
this project forbids.

**The one guard that must not be skipped:** the list response carries no `total`
(`apiPageMetaSchema` in `contracts/shared/api.schema.ts` is page-only), so a request that
returns exactly `perPage` rows is indistinguishable from one that was cut off. Both
services below must treat "returned count === requested perPage" as **`truncated: true`**
and the UI must surface it, rather than silently showing an incomplete catalogue the day
the shop passes 1000 rows.

### Verify Step 0

```powershell
npm run typecheck:api
npx tsx tests\server\unit\modules\price-list\price-list-writes.dry-test.ts
npx tsx tests\server\unit\contracts\price-list\price-list-api.schema.dry-test.ts
```

## Decision

Until customer-specific pricing is designed, every invoice uses PriceList rows whose
`priceGroup` is exactly `DEFAULT`.

The invoice picker must send `priceGroup=DEFAULT` to the API. It must not fetch every
price group and let staff select an arbitrary group. A later customer-pricing change
may replace this fixed query parameter with a resolved price group; it must not change
historical invoice line prices.

## Goal

Migrate the existing PriceList frontend and the invoice PriceList picker to the
backend v2 API contract:

- a PriceList row is one item × one service type × one price group;
- the row has one nonnegative `price`, rather than three service-specific price fields;
- `itemCode` is client-supplied when reusing an existing item.

The frontend consumes the shared API DTO directly. It must not create a mapper or
recalculate PriceList prices in the browser.

## Scope

Modify the `price-list` and `invoices` frontend features, their frontend dry tests, and
— only for Step 0 — the price-list API contract, server module, and their server tests.
Do not modify the `orders` feature: `OrderItemForm.vue` is not currently a PriceList
consumer, and connecting it requires the separate Order Item backend workflow.

## Live data this UI must actually handle

The sheet was migrated on 2026-09-05. Verified against it through the real service layer:

- 79 rows, of which **56 are `active: false`** — 33 of those are catalogue entries with a
  placeholder `price: 0` that have not been priced yet.
- `itemCode` repeats: `ITM-0010` has **four** rows — `WSIR 120`, `WSIR 700`, `IRON 400`,
  `DRCL 1200`, all active, all `priceGroup: DEFAULT`, all with the same
  `displayNameTh` ("ปลอกผ้านวม 3-4 ฟุต").
- Every row currently has `priceGroup: 'DEFAULT'`, `unit: 'piece'`, `displayNameEn: null`.

The two active `WSIR`/`DEFAULT` rows on `ITM-0010` are the shape this UI must not get
wrong: name, service type, and price group are identical, so **price is the only thing
that tells them apart**.

Confirmed working against the live sheet (do not re-litigate these):
`priceGroup=DEFAULT` → 79, `priceGroup=NOPE` → 0, `serviceType=DRCL` → 3,
`serviceType=IRON` → 1, `itemCode=ITM-0010` → 4.

## Public frontend behaviour

### PriceList management

`PriceListFormPage` creates and edits one concrete price option. Its form fields are:

- `itemCode` — see "Where itemCode comes from" below;
- category, subcategory, item type, optional variant;
- Thai name, optional English name;
- service type, price group, optional unit, required nonnegative price;
- credit eligibility, effective dates, and active state.

Blank optional text fields become `null`; a zero price remains numeric `0`. Client-side
validation improves feedback, while the shared Zod schema remains the API boundary.

The PriceList page keeps its category/search/list behaviour. It searches English names
as well as current searchable fields. Each card represents a price option, so multiple
cards may share an `itemCode` when they differ by service type, price group, or price.

**Promote price to a visually dominant field on `PriceListCard`**, alongside service
type. `itemCode` is already rendered (`PriceListCard.vue:52-53`) and should stay; price
is the buried one — it currently sits in `text-xs` secondary text
(`PriceListCard.vue:57-61`). Two cards can otherwise be pixel-identical (see `ITM-0010`
above), and a buried price makes them indistinguishable.

### Where itemCode comes from

**`itemCode` does not exist in this form today.** It is absent from form state
(`PriceListFormPage.vue:19-30`), from `fillForm` (`:60-73`), from `createPayload()`
(`:82-96`), and from the template; the only trace is the helper text
"รหัสรายการแก้ไขไม่ได้" (`:144`). It was never sent, because the backend minted it.
So this is a **new field to build**, not an existing behaviour to retain.

Two create modes, both inside `PriceListFormPage` — do not add a route or a second page:

1. **New item** — leave `itemCode` out of the payload entirely. The server assigns it
   (Step 0a). Show the field as "assigned automatically"; do not offer a guessed value
   for the staff member to accept or edit. **Never mint the code in the browser** — a
   client-guessed code is the exact failure both review rounds flagged.
2. **New price option for an existing item** — the staff member searches existing items
   by name or code and picks one. Choosing it fills `itemCode`, `category`,
   `subcategory`, `itemType`, `variant`, `displayNameTh`, and `displayNameEn` from that
   item, leaving `serviceType`, `priceGroup`, `unit`, and `price` to be entered.

On **edit**, `itemCode` stays read-only. Changing it would silently move the row to a
different item.

Client-side uniqueness must **not** be enforced: two rows sharing
`itemCode` + `serviceType` + `priceGroup` are legal price options, which is the entire
point of the schema change.

#### The store must load every row in one request, and must know when it did not

`price-list.store.ts:23-31` loads **one page** (`listPriceList({ perPage: 100 })`) and
`price-list.service.ts:17-24` throws the pagination metadata away. The contract caps
`perPage` at 100 (`price-list-api.schema.ts:29`). 79 rows fit today; past 100 the mode-2
item picker silently stops showing items that exist, with no error anywhere.

So, in this task:

- add `listAllPriceList()` to `price-list.service.ts` that makes **one** request with
  `perPage: 1000` (the Step 0b cap) and returns **`{ items, truncated }`**, where
  `truncated` is `items.length === 1000`;
- have `price-list.store.ts` use it and **expose `truncated`**. When `truncated` is true
  the catalogue may be incomplete: surface a load error and disable mode-2 item selection
  rather than marking the store `loaded` and letting the UI imply completeness. The
  store has no such state today (`:13-40`) — that gap is the bug being fixed.

**Delete the page loop in the invoice service too.** `fetchAllInvoicePriceListItems`
(`src/features/invoices/services/invoice-price-list.service.ts:12-56`) currently walks up
to 40 pages of 100 because the cap was 100. With the cap at 1000 it becomes the same
single request; drop `MAX_PAGES`, the `for` loop, and the short-page check, and keep
`truncated` computed the new way. Its public shape (`{ items, truncated }`) does not
change, so the picker, store, and existing tests keep working.

Both services now do the same one-request fetch. **Do not import one from the other** —
copy the few lines. Report the duplication under "SHARED GAPS".

### Invoice price picker

The picker requests `priceGroup=DEFAULT` from the API, added to the existing paged query
object at `invoice-price-list.service.ts:39-45`. **There is no `active` filter in the API
query contract** — `priceListListQuerySchema` (`price-list-api.schema.ts:20-32`)
deliberately has no `active` key — so active-only filtering stays where it already is,
client-side in `invoice-price-list.store.ts:36-37`. Do not go looking for a query
parameter that does not exist, and do not add one to the contract.

A selectable row already identifies exactly one service type and one price, so selecting
it adds one invoice line directly; there is no second service-chip selection.
`InvoicePriceListPicker.vue:28-32` currently emits `{ item, serviceKey }` and
`InvoiceCreatePage.vue:129-136` consumes `serviceKey` — both change together to a single
DTO. `InvoiceLineItemsEditor.vue` only opens the picker and needs no change.

#### An invoice line cannot store `serviceType` — put it in the description

`LineItemFormRow` has no `serviceType` field
(`src/features/invoices/types/invoice-create.types.ts:33-40`), `invoiceLineInputSchema`
is `.strict()` and accepts only `description`, `unit`, `quantity`, `unitPrice`,
`adjustments` (`contracts/invoices/invoice-api.schema.ts:77-85`), and the server writes
`service_type: null` unconditionally (`server/modules/invoices/invoice.service.ts:409`).

So the selected row's service type goes into the **description string only** — exactly
what v1 already did (`invoice-price-list.utils.ts:156` builds
`"${displayNameTh} (${serviceLabel})"`). Keep that. Do **not** add `serviceType` to the
form row, the request schema, or the server mapping in this task; record it under
"Backend follow-ups".

#### `unit` must be mapped, not assigned

PriceList `unit` is a free string (`price-list-api.schema.ts:63`), but the invoice editor
offers a closed set plus `custom`:
`['kg','piece','pair','package','set','load','custom']`
(`invoice-create.types.ts:28-31`, consumed at `InvoiceLineItemsEditor.vue:66-84`).
`LineItemFormRow` carries both `unit` (free string, submitted) and `unitOption` (the
select). So the converter must:

- set `unitOption` to the matching option when the PriceList unit is one of them
  (today every row is `piece`, so this is the normal path);
- otherwise set `unitOption: 'custom'` and keep the raw API string in `unit`.

Assigning `unitOption = item.unit` directly leaves the select on an unmatched value.
Cover an arbitrary unit such as `bag` in the dry test.

Because rows can be identical apart from price, **`InvoicePriceListItemRow` must render
the price as a primary element**, not a secondary chip.

Service-type presentation (Thai label/icon) is invoice-local shared presentation logic;
it must derive valid service codes from the shared PriceList contract rather than import
an orders feature helper or duplicate a free-form enum.

## Files to modify

| File | Change |
|---|---|
| *(Step 0)* `contracts/price-list/price-list-api.schema.ts` | Make `itemCode` optional on create only and omitted on update (0a); raise `perPage` max from 100 to 1000 (0b). |
| *(Step 0)* `server/modules/price-list/price-list.module.ts` | Restore `nextPriceListItemCode` from `f0c995a^`; mint `item_code` in `append` when absent. |
| *(Step 0)* `tests/server/unit/modules/price-list/price-list-writes.dry-test.ts`, `tests/server/unit/contracts/price-list/price-list-api.schema.dry-test.ts` | Cover supplied-vs-minted `itemCode`. |
| `src/features/price-list/services/price-list.service.ts` | Add `listAllPriceList()`: one request at `perPage: 1000`, returning `{ items, truncated }`. |
| `src/features/price-list/stores/price-list.store.ts` | Load via `listAllPriceList()`; expose `truncated`; do not mark `loaded` as complete when truncated. |
| `src/features/price-list/utils/price-list-form-payload.ts` | **New.** Form-state → create/update payload mapping, as plain functions taking plain form state. |
| `src/features/price-list/pages/PriceListFormPage.vue` | Replace three-price state/fill/payload with v2 fields; add the two itemCode modes; delegate mapping to the util. Keep route/query init, `props.id`/`isEdit`, refs, `fillForm`, and navigation in the page (`:12-124`) — they cannot move. |
| `src/features/price-list/components/PriceListCard.vue` | Service type, price group, one price (promoted out of `text-xs`), optional unit; keep the existing `itemCode` line; remove retired-price UI. |
| `src/features/price-list/pages/PriceListPage.vue` | Add English name to browser-side searching (`:39-57`). |
| `src/features/price-list/components/ServicePriceTriad.vue` | Delete; unused, models the retired three-price shape. |
| `src/features/price-list/components/PriceListStatusTabs.vue` | Currently unused (zero imports). Either wire it up as an active/inactive filter on `PriceListPage` — now genuinely useful, since 56 of 79 rows are inactive — or delete it. Do not leave it unused; say which you chose and why. |
| `src/features/invoices/services/invoice-price-list.service.ts` | Replace the 40-page loop (`:12-56`) with one `perPage: 1000` request; add `priceGroup: 'DEFAULT'`; keep `sortBy: 'itemCode'` and the `{ items, truncated }` return shape, with `truncated` now meaning "the response filled the cap". |
| `tests/web/unit/features/invoices/services/invoice-price-list-service.dry-test.ts` | **New.** Mock `fetch`; assert the request carries `priceGroup=DEFAULT` and `perPage=1000`, that exactly one request is made, and that a full-cap response sets `truncated: true`. Without this, omitting `priceGroup` passes every other listed check and looks correct against today's all-`DEFAULT` data. |
| `src/features/invoices/utils/invoice-price-list.utils.ts` | Replace per-service-price helpers (`:7-13`) with one-row selection and line conversion (`:148-162`); service type stays in the description string; map `unit` → `unitOption` as above; add invoice-local service presentation helpers and English-name search. |
| `src/features/invoices/components/InvoicePriceListItemRow.vue` | One DTO; service, group, price (primary), unit; remove service chips (`:16-30,67-78`). |
| `src/features/invoices/components/InvoicePriceListPicker.vue` | Emit the selected DTO instead of `{ item, serviceKey }`, preserving overlay/list lifecycle. |
| `src/features/invoices/pages/InvoiceCreatePage.vue` | Consume one DTO, append via existing placeholder-safe logic, close the picker. |
| `tests/web/unit/features/price-list/services/price-list-service.dry-test.ts` | **New.** Mock `fetch`; assert exactly one request is made at `perPage: 1000`, that a short response gives `truncated: false`, and that a full-cap response gives `truncated: true`. |
| `tests/web/unit/features/price-list/utils/price-list-form-payload.dry-test.ts` | **New.** `price: 0` survives as numeric `0`; blank optional text → `null`, not `''`; create omits `itemCode` in new-item mode; prefill-from-existing-item carries the code through. |
| `tests/web/unit/features/invoices/utils/invoice-price-list.utils.dry-test.ts` | v2 fixtures; zero price; two rows differing only by price; `unit: 'bag'` → `unitOption: 'custom'` with `unit` preserved; service type appears in the description; English search; grouping, cap, placeholder invariants. |

Test-layout note: existing **page** tests here (e.g.
`tests/web/unit/features/packages/pages/package-pages.dry-test.ts`) `readFileSync` the
`.vue` and assert with regexes — they cannot exercise logic. Executable tests sit beside a
plain `.ts` module (e.g. `tests/web/unit/features/invoices/utils/…`). That is why the
payload mapping is extracted into a util rather than tested through the page.

## Files that stay unchanged

- `src/features/invoices/stores/invoice-price-list.store.ts`: keeps its existing
  invoice-owned cache, load lifecycle, and client-side `active === true` filter. Its
  service changes underneath it; the store itself does not.
- `src/features/price-list/composables/usePriceListFilterRoute.ts` and
  `src/features/invoices/composables/useInvoiceItemPickerRoute.ts`: both already correct.
- `contracts/invoices/*` and everything under `server/` **except** the two Step 0 files.
  If the UI seems to need another contract change, report it rather than editing it.
- All `src/features/orders/**` files.

## Traps

- **Do not rename the `PriceListFormPage` component.** `src/App.vue:16-18` lists it in
  the `<KeepAlive>` `exclude` array, which matches on **component name, not file path**;
  the name is declared at `PriceListFormPage.vue:10` via `defineOptions`. Renaming it
  silently removes it from the list with no error anywhere, and the page starts caching
  — what a staff member typed for one item survives into the next one.
- **This project has no frontend type check.** `npm run build` is esbuild only, so a
  broken prop or DTO contract ships green. A green build is not evidence of anything.
- Vue casts an absent boolean prop to `false`, never `undefined`, so `??` defaults on
  boolean props are dead code. This has already shipped as a bug in this repo once.
- Do not create or modify anything in `src/shared/components/`. If nothing fits, build it
  inside the feature folder and report it under "SHARED GAPS".
- After deleting `ServicePriceTriad.vue`, check `git status --diff-filter=D` and confirm
  exactly the intended file(s) were removed.

## Implementation order

1. Step 0 (0a + 0b), with its server tests green.
2. `listAllPriceList()` + store `truncated` + its dry test, and collapse the invoice
   service's page loop to the same single request — everything else depends on the full
   row set being loaded.
3. Extract `price-list-form-payload.ts` and write its dry test.
4. Invoice utils + tests: row-to-line conversion, description, unit mapping.
5. `priceGroup: 'DEFAULT'` on the invoice query, then picker / row / create-page event
   signatures together.
6. PriceList form, card, local search, the two itemCode modes; delete `ServicePriceTriad`
   only after its references are gone.
7. Run the checks below.

## Verification

```powershell
npm run typecheck:api
npx tsx tests\server\unit\modules\price-list\price-list-writes.dry-test.ts
npx tsx tests\server\unit\contracts\price-list\price-list-api.schema.dry-test.ts
npx tsx --tsconfig jsconfig.json tests\web\unit\features\price-list\services\price-list-service.dry-test.ts
npx tsx --tsconfig jsconfig.json tests\web\unit\features\invoices\services\invoice-price-list-service.dry-test.ts
npx tsx --tsconfig jsconfig.json tests\web\unit\features\price-list\utils\price-list-form-payload.dry-test.ts
npx tsx --tsconfig jsconfig.json tests\web\unit\features\invoices\utils\invoice-price-list.utils.dry-test.ts
npx tsx --tsconfig jsconfig.json tests\web\unit\features\price-list\composables\usePriceListFilterRoute.dry-test.ts
npx tsx --tsconfig jsconfig.json tests\web\unit\shared\components\app-header-searchable.dry-test.ts
npx tsx --tsconfig jsconfig.json tests\web\unit\shared\layouts\list-page-layout.dry-test.ts
npm run build
```



`npm run build` only proves the bundle compiles. Because there is no frontend type check,
this task is **not** done until it has been driven in a real browser against the live
sheet. Confirm, by clicking:

- creating a brand-new item saves and comes back with a server-assigned `itemCode`;
- adding a second price option to `ITM-0010` reuses that code and does not create a new
  item;
- `itemCode` is read-only when editing an existing row;
- the PriceList page shows the two active `WSIR` rows on `ITM-0010` as visibly different
  (120 vs 700);
- a `price: 0` row displays as `0` and submits as `0`, not as blank or `null`;
- the invoice picker requests only `DEFAULT`, hides inactive rows, and selecting a row
  produces one line whose description names the service, with that row's unit and price.

## Backend follow-ups — report, do not build

- **Every other module that pages a sheet still has the unstable-paging bug.** Step 0b
  sidesteps it for price-list by not paging at all, which only works because the
  catalogue is small. `order by <non-unique column>` + `limit/offset`
  (`gviz-query.builder.ts:96-104`) can skip rows wherever real paging is unavoidable —
  Orders and OrderItems are the ones that will actually hit it. The general fix is a
  deterministic tiebreak on the primary key in the server-side ordering.
- The list response has no `total` (`apiPageMetaSchema`), which is why "did I get
  everything?" has to be guessed from a full-looking page.
- **`InvoiceItems.service_type` is hardcoded `null`** (`invoice.service.ts:409`), so an
  invoice line's service survives only inside the description text. If service becomes a
  reportable field, it needs a real column path end to end.
- There is no `active` filter on the list query, so the invoice picker downloads 79 rows
  to display 23.

## Report back

State which choice you made for `PriceListStatusTabs.vue`, list anything you had to build
locally because no shared component fit (under "SHARED GAPS"), and report — do not fix —
any backend contract gap you hit.
