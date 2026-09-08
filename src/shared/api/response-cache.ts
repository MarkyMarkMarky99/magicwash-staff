import { CACHE_MAX_BYTES, cachePolicyFor } from '@/shared/config/cache'

/**
 * In-memory store behind {@link apiGet} and {@link apiGetList}.
 *
 * Entries are keyed by the full request URL, so every distinct filter is its own
 * entry and `invalidate('/api/customers')` clears the whole endpoint at once.
 *
 * This is the first thing in the app that can grow without bound — the feature
 * stores each hold a single slot and overwrite it — hence the byte ceiling and
 * least-recently-used eviction below.
 */

interface CacheEntry {
  value: unknown
  bytes: number
  storedAt: number
  /**
   * Monotonic use counter, not a timestamp: several reads and writes land inside
   * the same millisecond, which would leave `Date.now()` tied and make eviction
   * fall back to insertion order.
   */
  lastUsed: number
}

const HOUR_MS = 60 * 60 * 1000

const entries = new Map<string, CacheEntry>()
let totalBytes = 0
let useCounter = 0

/** Approximate an entry's footprint. Exact enough to enforce a ceiling. */
function measure(value: unknown): number {
  try {
    return JSON.stringify(value)?.length ?? 0
  } catch {
    return 0
  }
}

function drop(key: string): void {
  const entry = entries.get(key)
  if (!entry) return
  totalBytes -= entry.bytes
  entries.delete(key)
}

/** Evict least-recently-used entries until the total fits under the ceiling. */
function evictDownTo(limit: number): void {
  if (totalBytes <= limit) return

  const byAge = [...entries.entries()].sort((a, b) => a[1].lastUsed - b[1].lastUsed)
  for (const [key] of byAge) {
    if (totalBytes <= limit) return
    drop(key)
  }
}

export interface CacheHit<T> {
  value: T
  /** False when the entry is past its configured freshness window. */
  fresh: boolean
}

/**
 * Read an entry, or `null` when nothing is stored for this URL.
 *
 * A stale hit is still returned — the caller shows it immediately and refreshes
 * in the background.
 */
export function readCache<T>(url: string): CacheHit<T> | null {
  const entry = entries.get(url)
  if (!entry) return null

  entry.lastUsed = ++useCounter

  const { hours } = cachePolicyFor(url)
  const fresh = hours > 0 && Date.now() - entry.storedAt < hours * HOUR_MS
  return { value: entry.value as T, fresh }
}

/** Store a response, evicting colder entries if it pushes past the ceiling. */
export function writeCache(url: string, value: unknown): void {
  if (!cachePolicyFor(url).cacheable) return

  const bytes = measure(value)
  // A single response larger than the whole budget is not worth evicting
  // everything else for.
  if (bytes > CACHE_MAX_BYTES) return

  drop(url)
  entries.set(url, { value, bytes, storedAt: Date.now(), lastUsed: ++useCounter })
  totalBytes += bytes

  evictDownTo(CACHE_MAX_BYTES)
}

/**
 * Drop cached responses so the next read goes to the network.
 *
 * Call it after a write, or from a refresh control. `invalidate()` with no
 * argument clears everything; a path clears that endpoint and every filtered
 * variant of it.
 */
export function invalidate(path?: string): void {
  if (path === undefined) {
    entries.clear()
    totalBytes = 0
    return
  }

  const pathname = path.split('?')[0] ?? path
  for (const key of [...entries.keys()]) {
    const keyPath = key.split('?')[0] ?? key
    if (keyPath === pathname || keyPath.startsWith(`${pathname}/`)) drop(key)
  }
}

/** Current footprint, for tests and diagnostics. */
export function cacheStats(): { entries: number; bytes: number } {
  return { entries: entries.size, bytes: totalBytes }
}
