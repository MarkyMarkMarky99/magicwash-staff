/**
 * Cache policy for `/api/*` GET responses.
 *
 * Reads only. Writes are never cached, and nothing here observes them: a cached
 * entry is dropped when someone calls `invalidate()` — a save handler, or a
 * staff-facing refresh control. See `docs/plans/cache-gateway.md`.
 */

/**
 * Hours a cached response counts as fresh.
 *
 * `0` does not mean "do not cache". It means the entry is always refetched, but
 * the cached copy is still served first so the page never waits on the network.
 */
export const DEFAULT_CACHE_HOURS = 0

/**
 * Per-endpoint freshness overrides, matched against the start of the request path.
 *
 * An endpoint may only appear here once the writes that affect it call
 * `invalidate()`, or staff see their own edit fail to appear. Both entries below
 * are covered: every write service invalidates, and the nav sidebar has a refresh
 * control for the case this cannot cover — a change made from another device or
 * typed straight into the sheet, which this browser has no way to learn about.
 *
 * One hour, not the 24 the design first proposed: the write path is only as good
 * as its least-covered branch, and an hour bounds how long a miss can be visible
 * while still absorbing a whole shift's worth of repeat page loads. Raise it once
 * the pair has been in real use.
 */
const CACHE_HOURS: Record<string, number> = {
  '/api/customers': 1,
  '/api/price-list': 1,
}

/**
 * Endpoints kept in `localStorage`, so a page reload paints from a stored copy
 * instead of an empty screen.
 *
 * Only near-static lists belong here: customers (140 KB) and the price list
 * (30 KB) barely change, while invoices and orders change daily and are queried
 * under many filter combinations, which would only churn the store.
 */
const PERSIST_ENDPOINTS: readonly string[] = ['/api/customers', '/api/price-list']

/** Endpoints that must never be served from cache, not even stale. */
const NEVER_CACHE: readonly string[] = []

/** Ceiling across every cached entry; least-recently-used entries go first. */
export const CACHE_MAX_BYTES = 4 * 1024 * 1024

/**
 * Separate ceiling for the persisted half, kept well under the in-memory one.
 *
 * `localStorage` holds ~5 MB for the whole origin and is shared with everything
 * else the app stores there — the issue-report reporter name among them — so the
 * cache may not spend the whole quota. The two endpoints listed above measure
 * 170 KB together, which leaves room for their filtered variants.
 */
export const PERSIST_MAX_BYTES = 2 * 1024 * 1024

export interface CachePolicy {
  /** Whether this path may be cached at all. */
  cacheable: boolean
  /** Hours the entry counts as fresh; 0 means always revalidate. */
  hours: number
  /** Whether the entry survives a page reload. */
  persist: boolean
}

function matches(path: string, prefix: string): boolean {
  return path === prefix || path.startsWith(`${prefix}/`) || path.startsWith(`${prefix}?`)
}

/** Resolve the policy for a request path (query string included or not). */
export function cachePolicyFor(path: string): CachePolicy {
  const pathname = path.split('?')[0] ?? path

  if (NEVER_CACHE.some((prefix) => matches(pathname, prefix))) {
    return { cacheable: false, hours: 0, persist: false }
  }

  const configured = Object.entries(CACHE_HOURS).find(([prefix]) => matches(pathname, prefix))
  const persist = PERSIST_ENDPOINTS.some((prefix) => matches(pathname, prefix))

  return { cacheable: true, hours: configured?.[1] ?? DEFAULT_CACHE_HOURS, persist }
}
