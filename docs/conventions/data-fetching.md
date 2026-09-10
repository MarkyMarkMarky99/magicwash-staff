---
last_audited: 2026-09-10
audit_sources:
  - src/shared/api/api-client.ts
  - src/shared/api/response-cache.ts
  - src/shared/api/persistent-cache.ts
  - src/shared/config/cache.ts
  - src/shared/components/ListContainer.vue
  - src/features/customers/pages/CustomerDetailPage.vue
---

# Data Fetching and Cache

How reads reach the API, how they are cached, and how a page reports loading.
Build history for the cache gateway is in `docs/plans/cache-gateway.md`.

## Every read goes through the client

- Read with `apiGet` / `apiGetList` (`src/shared/api/api-client.ts:60-78`). No direct `fetch`.
- These two functions are the only place caching, in-flight de-duplication, and `invalidate()`
  reach every feature at once. A bypass gets none of it.
- Current violations: the gallery injects browser GViz JSONP at `src/utils/gviz.js:33` and
  `src/api/photos.js:19`.

## Cache policy

Classify every new endpoint in `src/shared/config/cache.ts`:

| Class | `hours` | `persist` | For |
|---|---|---|---|
| Reference | 1-24 | yes | changes rarely, read often — customers, price list |
| Transactional | 0 | yes | changes daily, writes invalidate it — orders, invoices, appointments |
| Never | `cacheable: false` | — | needs a stated reason |

- `hours: 0` does not disable the cache. It serves the stored copy first, then revalidates
  (`api-client.ts:93-106`). It is the safe default, not an opt-out.
- `hours` is a plain number. `0.05` is 3 minutes; nothing floors it.
- Listing a path also persists it to `localStorage`.

Constraints to design around:

- Matching is prefix-based and strips the query string (`cache.ts:75-84`). One policy covers a
  list endpoint and its detail route — they cannot be tuned apart.
- Budgets: 4 MiB memory, 2 MiB persisted (`cache.ts:49-60`).
- Memory evicts by least-recently-used; persisted evicts by stored age, because `localStorage`
  records no reads (`persistent-cache.ts:142-146`).
- Bump `STORAGE_VERSION` in `persistent-cache.ts` when a stored response shape changes.

## `onFresh` is required

- Any read that can serve a stale copy must pass `onFresh` and let its store replace the value.
- Without it the background refresh updates the cache and leaves the rendered page stale until the
  next visit. Declared at `api-client.ts:39-54`, invoked at `api-client.ts:93-103`.
- As of this audit **0 of 23 read call sites pass it**. Treat that as debt, not as precedent.

## Invalidation

- Every write service calls `invalidate(path)` for the paths its write affects.
- Invalidation is explicit. Nothing infers it from the write.

## Loading state

- Never gate a whole page on a single loading flag. Each block owns its own.
- A block whose data is already in hand renders immediately.
- Follow `ListContainer.vue:141-164` for list pages and `CustomerDetailPage.vue:163-174` for
  detail pages.
- Current violations: `OrderDetailPage.vue:185`, `InvoiceDetailPage.vue:107-129`,
  `InvoiceCreatePage.vue:363-410`, `CustomerPackageDetailPage.vue:128-130`,
  `IssueReportDetailPage.vue:79-88`.

## Bounded queries

- Every list query carries a real bound — a date, a status, an owning id.
- `perPage` is a page size, not a bound. On its own it drops rows with no error.
