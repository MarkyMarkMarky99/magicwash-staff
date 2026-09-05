# Plan — Customer detail: Orders / Packages / Invoices tabs + package actions

Branch: `feat/customer-detail-tabs` (cut from `origin/main`).
Scope: **frontend only.** No backend, contract, or schema changes — every API this needs already exists.
Read the repo-root `CLAUDE.md` first; it overrides anything inferred from surrounding code.

---

## 1. What we are building

The customer detail page (`/customers/:customerId/orders`) shows one section today: Order History.

Four deliverables:

1. **Tabs** — Orders / Packages / Invoices on the customer detail page, all three rendered through the shared `ListContainer` so they look identical.
2. **Buy package** — a button in the Packages section header that opens the existing create-package page pre-filled with this customer.
3. **Package history** — the Packages tab *is* the per-customer package history; it did not exist before.
4. **Record package usage from an order** — from the order detail sheet, log a `USAGE` transaction against one of the customer's active packages, tagged with the order id.

Items 1–3 are one unit of work. Item 4 is independent and can land as a second commit.

---

## 2. Hard constraints — the traps

**T1 — `src/shared/` is import-only.** Do not edit `ListContainer.vue`, `GenericTabs.vue`, or anything else under `src/shared/`. They already have what is needed (`ListContainer` has an `#actions` header slot at `ListContainer.vue:54`). There is no frontend type-check here — `npm run build` is esbuild only — so a broken shared prop contract ships green and breaks other pages silently. If something genuinely does not fit, build it locally under `src/features/customers/` and report it under **SHARED GAPS**.

**T2 — This page is KeepAlive-cached.** It is not on the `exclude` list at `src/App.vue:18`. So **tab state must be a `computed` off the route, never a local `ref`** — a cached ref reopens the page on the previous customer's tab with no error anywhere. Same reason the new stores are keyed by `customerId`.

**T3 — Never touch history by hand.** No `history.pushState` / `back()` / `popstate`. Tabs switch with `router.replace` (replace-only, like `useCustomerFilterRoute.ts` — tabs have no dismiss/undo semantics). Dismissible overlays are represented as a route query param, following `useOrderSheetRoute.ts`.

**T4 — Never write to `G:\My Drive\Magicwash\Database\GoogleSheets\*.json`.** Shared schema registry, source of truth, also used by the Python project. Nothing here needs to open it.

**T5 — No nested / `children` routes anywhere in this project.**

**T6 — Do not modify:** `OrderCard.vue`, `InvoiceCard.vue`, `CustomerPackageListCards.vue`, `CustomerPackageListPage.vue`, `CustomerPackageCreatePage.vue`, `CustomerPackageDetailPage.vue`, `InvoiceListPage.vue`, or anything under `contracts/`, `api/`, `server/`.

**T7 — Do not reuse `useCustomerPackageFilterRoute` / `useInvoiceFilterRoute`.** They hardcode `router.replace({ name: 'customer-package-list' })` and `{ name: 'invoice-list' }`, which would navigate the user off the customer page. Build the filter objects literally (§5, §6).

---

## 3. Route change

`src/features/customers/routes.ts:17-21` — change to:

    path: '/customers/:customerId/:tab?'
    name: 'customer-detail'
    component: () => import('./pages/CustomerDetailPage.vue')
    meta: { parent: 'customer-list' }
    props: true

The optional `:tab?` keeps `/customers/<id>/orders` valid, so no existing link breaks and no redirect is needed. `/customers/<id>` also works and falls back to Orders.

Rename the page file `CustomerOrderHistoryPage.vue` → `CustomerDetailPage.vue`. `<KeepAlive :exclude>` matches by component name and this page is deliberately not on that list, so the rename is safe — do **not** add it to the list. Keep `customer-order-history.store.ts` and its Pinia id unchanged; renaming that is out of scope.

Call sites to update — grep-confirmed, this is all of them:

- `src/features/invoices/pages/InvoiceCreatePage.vue:334-340` — route name `customer-order-history` → `customer-detail`.
- `src/features/customers/components/CustomerCard.vue:49-50` — pushes a `/customers/<id>/orders` path string; switch to the named route.
- Docs `docs/frontend-layout-nav-refactor.md:19,21,205` and `docs/features/orders/overview.md:52` mention the old name/path — update those mentions only.
- No `router-link`, no test references the old name.

Verify in the browser that `/customers/new` still opens the create-customer page and is not swallowed by `:customerId`.

---

## 4. Page layout

Inside `<AppLayout>`, in this order:

    AppHeader (from AppLayout)
    GenericTabs               <- directly under the header
    OrderHistoryCustomerCard  <- unchanged, visible on all three tabs
    <tab section>             <- v-if, not v-show
    OrderDetailSheet          <- orders tab only

**Tabs sit directly under the header, above the customer card.** `GenericTabs` renders `bg-primary` and is built to sit flush against the primary-coloured header — every other page places it there. Below the white customer card it becomes a floating dark bar. Do not "fix" this by moving it. The customer card stays on every tab because it carries identity plus Schedule Pickup, neither of which is tab-specific.

Props become `{ customerId: string; tab?: string }` (`props: true` now passes `tab`).

Extract the tab resolver to `src/features/customers/utils/customer-tab.ts`:

    export const CUSTOMER_DETAIL_TABS = ['orders', 'packages', 'invoices'] as const
    export function resolveCustomerTab(value: unknown): CustomerDetailTab  // falls back to 'orders'

Page uses `const activeTab = computed(() => resolveCustomerTab(props.tab))` and switches with
`router.replace({ name: 'customer-detail', params: { customerId, tab } })`. That drops `route.query`, closing an open `?order=` sheet when leaving the Orders tab — intended.

Tabs carry **no counts**. `GenericTabs` supports `count`, but showing them forces all three datasets to load on mount, defeating the lazy loading in §7.

Everything else in the page stays: `store.load(customerId)` on mount and on `customerId` change, `useOrderSheetRoute()`, `bookDelivery()`, `createInvoice()`, `OrderDetailSheet`.

---

## 5. Orders tab — refactor onto `ListContainer`

`src/features/customers/components/OrderList.vue` builds its header by hand (~lines 42-76). Replace that header with `ListContainer`, keeping the script logic, emits, and row rendering unchanged:

`title="Order History"`, reuse the icon string already in the current markup, `:count="orders.length"`, `count-label="orders"`, `collapsible`, `:loading="ordersLoading || appointmentsLoading"`, `:error` = a **string or null** (never a boolean — the prop is typed `String`), `:empty` when both `orders` and `waitingPickups` are empty, `:skeleton-rows="4"`. Existing refresh button goes in `#actions` with `@click.stop` (the header row itself toggles collapse). Delete the local `collapsed` ref — `ListContainer` owns collapse. Do not add row dividers; the default slot is already wrapped in `divide-y`.

---

## 6. Packages and Invoices tabs

### Stores — two new ones, in `src/features/customers/stores/`

| File | Pinia id | Service imported |
|---|---|---|
| `customer-packages.store.ts` | `customer-detail-packages` | `getCustomerPackages` from `@/features/customer-packages/services/customer-package.service` |
| `customer-invoices.store.ts` | `customer-detail-invoices` | `getInvoices` from `@/features/invoices/services/invoice.service` |

**Do not reuse `useCustomerPackageStore` / `useInvoiceStore`.** Each is a single flat list shared with its global list page; sharing means visiting `/customer-packages` and coming back shows another customer's rows inside this cached page, silently.

Each store: `items`/`invoices`, `loading`, `error`, plus a module-local `loadedCustomerId` and a `latestRequest` counter. Copy the stale-response race guard from `customer-package.store.ts:18-36` and the skip-unless-`force` guard from `customer-order-history.store.ts`:

    async function load(customerId: string, force = false) {
      if (!force && loadedCustomerId === customerId) return
      ...
    }

Filters, built literally (see T7):

- packages — `{ keyword: '', customerId, status: null, packageCode: null, page: 1, perPage: 20, sortBy: 'startDate', sortOrder: 'desc' }`
- invoices — `{ keyword: '', customerId, status: null, dateFrom: null, dateTo: null, page: 1, perPage: 20, sortBy: 'issuedDate', sortOrder: 'desc' }`

### Components — `src/features/customers/components/`

**`CustomerPackagesSection.vue`** — props `{ customerId }`. `ListContainer` with `title="Packages"`, `icon="card_membership"`, count/loading/error/empty from the store, `empty-text="No packages"`. Body reuses `CustomerPackageListCards` unchanged (takes `items`, emits `select`); `select` pushes `customer-package-detail`.

`#actions` holds the **buy button**: copy the pill markup from `CustomerPackageListPage.vue:31-38` (`bg-primary`, `material-symbols-outlined` `add`), label it **"Buy"** — it shares the row with the count badge. `@click.stop`. Target:

    router.push({ name: 'customer-package-create', query: { customerId } })

`CustomerPackageCreatePage.vue:78-80` already reads `?customerId=` on mount and pre-fills, so that page needs no change.

**`CustomerInvoicesSection.vue`** — props `{ customerId }`. `ListContainer` with `title="Invoices"`, `icon="receipt_long"`, `empty-text="No invoices"`. There is no invoice list-cards wrapper: `v-for` `InvoiceCard` directly, exactly as `InvoiceListPage.vue:92-97` does. `select` pushes `invoice-detail`. No `#actions` — invoice creation already has its entry point from the order sheet.

---

## 7. Loading strategy

Lazy, per tab. Orders is unchanged and still loads on mount, because `OrderHistoryCustomerCard` needs `customer` from that store on every tab. Packages and Invoices load on first activation:

    watch([activeTab, () => props.customerId], ([tab, id]) => {
      if (tab === 'packages') void packagesStore.load(id)
      if (tab === 'invoices') void invoicesStore.load(id)
    }, { immediate: true })

The `loadedCustomerId` guard makes re-entering a tab free and makes a different customer re-fetch.

---

## 8. Record package usage from an order

**Entry point: `src/features/customers/components/OrderDetailSheet.vue`.** It already carries View Photos / Book Delivery / Create Invoice and is used only by this page, so nothing shared changes. Add a fourth action, **"Use package credit"**, that emits up to the page.

Hide or disable the action when the customer has no `ACTIVE` package — read that from the packages store (`items.filter(p => p.status === 'ACTIVE')`); the page must ensure that store is loaded even on the Orders tab before showing the action.

**Overlay: build a local `OrderPackageUsageOverlay.vue` in `src/features/customers/components/`.** Do **not** reuse `CustomerPackageTransactionForm` — it exposes a free transaction-type select and free reference fields, and has no package picker. Here type, reference source, and reference id are all fixed by context. Use a shared overlay shell from `src/shared/layouts/` (`FormOverlay` / `BaseOverlay`) and report the decision under **SHARED GAPS**.

Fields:

| Field | Behaviour |
|---|---|
| Package | select over the customer's `ACTIVE` packages showing name + remaining credit; auto-selected and read-only when there is exactly one |
| Credits used | positive number input; **negated on submit** — the contract requires `creditChange < 0` for `USAGE` |
| Notes | optional |
| Staff identity | required text; default from `?by=` if present. There is no current-user store anywhere in `src/` — every actor in this app is typed or passed by query |

Fixed, not user-editable: `type: 'USAGE'`, `referenceSource: 'ORDER'`, `referenceId: <orderId>`. The backend accepts these fields today but nothing currently writes them, so this is the first code that links an order to a package ledger row.

Submit calls `appendPackageTransaction` from `@/features/customer-packages/services/customer-package.service`. Handle the response `kind` union — copy the handling from `CustomerPackageDetailPage.vue:76-101`:

- `created` — force-reload the packages store, close the overlay
- `validation_error` — show `issues`, keep the overlay open
- `package_not_found` / `package_lookup_failed` — show the message, keep open
- `transaction_write_failed` with `certainty: 'unknown'` — **block retry** and say the write may have gone through. Network and parse failures are synthesized into this shape, so a naive retry can double-deduct.

**Route:** the overlay is dismissible with Back, so it is a route query param (T3). Add `useOrderPackageUsageRoute.ts` in `src/features/customers/composables/`, copying `useOrderSheetRoute.ts` exactly with key `packageUsage`: open state is a `computed` off the query (never mirrored into a ref — on a cached page a stale mirror makes reopening the same order a silent permanent no-op), `router.push` to open, `router.back()` to close only when this page pushed the entry, otherwise strip the query with `router.replace`. It nests under the existing `?order=` entry, giving `?order=<id>&packageUsage=1`.

---

## 9. Test

One dry-test, for the pure function only:
`tests/web/unit/features/customers/utils/customer-tab.dry-test.ts` — assert with `node:assert/strict` that the three valid tabs pass through and that `undefined`, `''`, `'garbage'`, `null` and a number all return `'orders'`.

```bash
npx tsx --tsconfig jsconfig.json tests/web/unit/features/customers/utils/customer-tab.dry-test.ts
```

`--tsconfig jsconfig.json` is required — web tests import `src/` code via the `@/` alias, which bare `tsx` cannot resolve. Do not add, delete, or modify any other test file.

---

## 10. Verification

```bash
npm run build
```

This is esbuild with **no type-check**, so green proves only that nothing failed to parse or resolve. Say that in the report rather than calling it a pass.

Then check by hand in the browser and report what you actually observed:

1. `/customers/<id>/orders` — Orders tab active, list renders, `ListContainer` header shows count + refresh + collapse.
2. `/customers/<id>` and `/customers/<id>/garbage` — both fall back to Orders, no crash.
3. `/customers/new` still opens the create-customer page.
4. Packages tab loads; the **Buy** button opens `/customer-packages/create?customerId=<id>` pre-filled.
5. Invoices tab loads; rows open invoice detail. Package rows open package detail.
6. Open an order (`?order=` appears), switch tabs — the sheet closes, Back does not skip or double-navigate.
7. Header Back returns to the customer list.
8. Customer A's Packages tab → Back → open customer B → B's packages show, **not** A's. This is the T2 KeepAlive trap; failure here means the store guard is wrong.
9. Package usage: record a usage against an order, confirm remaining credit drops by the entered amount, and that the new ledger row on the package detail page shows reference source `ORDER` and the order id.
10. Package usage with the customer having zero active packages — the action is hidden or disabled, not a crash.

Do not commit. Leave the work in the tree for review.

---

## 11. Report back — terse, structured, no narrative

- **DONE** — files added / changed / renamed, one line each.
- **VERIFIED** — the numbered checks from §10 with actual observed results; say plainly which you could not run and why.
- **SHARED GAPS** — anything built locally because a shared component did not fit, naming what was needed and why.
- **RULE TENSION** — `CLAUDE.md` says avoid cross-feature imports, and this plan deliberately imports `getCustomerPackages`, `getInvoices`, `appendPackageTransaction`, `CustomerPackageListCards` and `InvoiceCard` from other features. That is the intended call: the alternative is duplicating API logic, which the same file forbids more strongly. Confirm what crossed features so it is on the record.
- **FOLLOW-UPS** — things noticed and correctly left alone. Known one already: `CustomerPackageCreatePage.vue:123` still renders `CustomerPicker` even when `customerId` arrives pre-filled.

Report problems rather than expanding scope. If something here turns out to be wrong about the code, stop and say so instead of inventing a different design.
