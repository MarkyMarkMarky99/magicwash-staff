# Handoff — central cache gateway for `/api/*` reads

Status: **designed, not built.** Written 2026-09-08 at the end of an investigation session so the
work can continue in a fresh conversation. Everything below is measured or read out of the code —
no assumptions carried over.

## Goal

One place that caches GET responses for every feature, instead of each Pinia store inventing its
own caching. Frontend only; no backend change.

## Why this shape

`src/shared/api/api-client.ts` is the single choke point. Every read in the app goes through
`apiGet()` (`:67-73`) or `apiGetList()` (`:48-64`). There is no axios, no XMLHttpRequest, and no
other HTTP client anywhere in `src/`. Wrapping those two functions reaches every page at once.

## Decisions already made — do not reopen

1. **Reads only.** `apiPost` / `apiPatch` and the three services that call `fetch()` directly are
   out of scope and must not be touched.
2. **Invalidation is explicit, not automatic.** Export an `invalidate(path)` function that any
   caller can import — a staff-facing refresh button, or a form after it saves. This deliberately
   avoids needing writes to flow through the client: the three bypassing services can call
   `invalidate()` like anything else.
3. **Stale-while-revalidate always.** Serve the cached copy immediately, refresh in the background,
   swap in the new data when it lands. The page never blocks on the network when a cached copy
   exists.
4. **TTL lives in a config file**, `src/shared/config/cache.ts`, next to the existing
   `src/shared/config/actor.ts`. Unit is hours; `0` means "always refetch, but still show the
   cached copy first"; `0` is the default for any endpoint not listed.
5. **Two storage layers.** In-memory first, `localStorage` for the endpoints explicitly listed in
   the config. Read memory → then localStorage → then network.
6. **Images stay out of it.** They are `<img src>` fetches the browser caches on its own; see
   `docs/plans/image-pipeline.md`.

## Measured facts this design rests on

Response sizes, taken against `vercel dev` on 2026-09-08:

| endpoint | bytes |
|---|---|
| `/api/customers` (all 466 rows, `perPage` defaults to 2000) | 140 KB |
| `/api/price-list?perPage=1000` | 30 KB |
| `/api/invoices?perPage=20` | 11 KB |
| `/api/work-orders?perPage=20` | 6 KB |

Everything the app can cache at once is under 1 MB, so a 4 MB ceiling is generous and
`localStorage`'s 5 MB quota is not a real constraint for JSON.

Two claims that were in the project memory and are now **disproven** — do not act on them:

- *"invoices / customer-packages / orders refetch on every visit."* They do not. `src/App.vue:17-21`
  wraps the router view in `KeepAlive` with only nine form pages excluded, and those list pages
  fetch from `watch(..., { immediate: true })` with no `onActivated`. Returning to a page with the
  same query issues no request. The slow part is the **first** load.
- *"a per-store `loaded` flag is the biggest win available."* It is not; see the latency ranking in
  `.user/memory/MEMORY.md`, where the real cost is a backend fan-out read.

Cache hygiene as it stands today: eleven stores cache something, **none** has a TTL, LRU, or any
eviction, and none accumulates either — each holds one slot and overwrites it (a new customer
replaces the previous customer's arrays, a new date replaces `dailyItems`, a new order replaces its
images). A URL-keyed gateway is the first thing in this app that can grow without bound, which is
why the size cap and eviction below are not optional.

## Shape to build

```ts
// src/shared/config/cache.ts

/** Hours a cached response stays fresh. 0 = always refetch, but serve the
 *  cached copy first so the page never waits on the network. */
export const DEFAULT_CACHE_HOURS = 0

/** Per-endpoint overrides, matched against the start of the request path.
 *  Being listed here ALSO means the entry is persisted to localStorage. */
const CACHE_HOURS: Record<string, number> = {
  '/api/customers': 24,
  '/api/price-list': 24,
}

/** Endpoints that must never be cached at all. */
const NEVER_CACHE: string[] = []

/** Total ceiling across every cached entry; evict least-recently-used past it. */
export const CACHE_MAX_BYTES = 4 * 1024 * 1024
```

Matching is by path prefix, so `/api/customers` covers every query string on that endpoint and
`invalidate('/api/customers')` clears the whole group under the same rule.

Only `/api/customers` (140 KB) and `/api/price-list` (30 KB) are worth persisting: they barely
change. Invoices and orders change daily and are queried under many filter combinations, so
persisting them only churns the store.

### Build order

1. `src/shared/config/cache.ts` — the values above.
2. In-memory layer: a `Map`, byte accounting, LRU eviction, and `invalidate(path)`.
3. Wire into `apiGet` / `apiGetList`. Stop here and verify in a browser.
4. `localStorage` layer for the listed endpoints.
5. A staff-facing refresh control that calls `invalidate()`.

Steps 1-3 are useful on their own, roughly an hour. Steps 4-5 another hour.

### Three failure modes to handle

1. **`localStorage` is full** — wrap every read and write in `try`/`catch`; on failure carry on with
   the in-memory layer rather than throwing.
2. **Private browsing** — reads can come back empty or throw; the page must render correctly with no
   stored value.
3. **Stale data from an older deploy** — put a version marker in the storage key and drop everything
   when it does not match, or a shape change ships broken data to returning staff.

## Still undecided

- Which endpoints, if any, belong in `NEVER_CACHE`.
- Where the refresh control lives in the UI, and whether it clears one endpoint or everything.
- Whether entries persisted to `localStorage` should also be capped separately from the 4 MB total.

## Files a new session should read first

- `src/shared/api/api-client.ts` — the whole client; `:48-73` are the two functions to wrap.
- `src/shared/config/actor.ts` — the convention the new config file should match.
- `src/features/customers/stores/customer.store.ts` — the simplest existing cache (`loaded` flag).
- `src/features/price-list/stores/price-list.store.ts:18-60` — the most developed one, with in-flight
  request de-duplication worth copying.
- `src/App.vue:15-21` — the `KeepAlive` config that already prevents refetch-on-revisit.
