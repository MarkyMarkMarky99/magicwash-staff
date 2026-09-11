import { CACHE_MAX_BYTES, cachePolicyFor } from '@/shared/config/cache'
import { clearPersisted, readPersisted, writePersisted } from '@/shared/api/persistent-cache'

/**
 * In-memory store behind {@link apiGet} and {@link apiGetList}.
 *
 * Entries are keyed by the full request URL, so every distinct filter is its own
 * entry and `invalidate('/api/customers')` clears the whole endpoint at once.
 *
 * This is the first thing in the app that can grow without bound — the feature
 * stores each hold a single slot and overwrite it — hence the byte ceiling and
 * least-recently-used eviction below.
 *
 * Endpoints the policy marks `persist` are mirrored into `localStorage` by
 * `persistent-cache.ts`, so they survive a reload. That layer is consulted only
 * on an in-memory miss, and a hit from it is promoted back into memory keeping
 * its original timestamp — a reload must not make a stale entry look fresh.
 */

interface CacheEntry {
  value: unknown
  bytes: number
  storedAt: number
  // Keep LRU order deterministic within the same millisecond.
  lastUsed: number
}

const HOUR_MS = 60 * 60 * 1000

const entries = new Map<string, CacheEntry>()
let totalBytes = 0
let useCounter = 0

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
  const entry = entries.get(url) ?? promoteFromStorage(url)
  if (!entry) return null

  entry.lastUsed = ++useCounter

  const { hours } = cachePolicyFor(url)
  const fresh = hours > 0 && Date.now() - entry.storedAt < hours * HOUR_MS
  return { value: entry.value as T, fresh }
}

/**
 * Move a stored response into the in-memory map on the first miss for this URL,
 * so later reads in the same session skip `localStorage` and its JSON parse.
 */
function promoteFromStorage(url: string): CacheEntry | null {
  const policy = cachePolicyFor(url)
  if (!policy.cacheable || !policy.persist) return null

  const stored = readPersisted(url)
  if (stored === null) return null

  return store(url, stored.value, stored.storedAt, false)
}

export function writeCache(url: string, value: unknown): void {
  const policy = cachePolicyFor(url)
  if (!policy.cacheable) return

  store(url, value, Date.now(), policy.persist)
}

// Preserve age without rewriting entries promoted from storage.
function store(url: string, value: unknown, storedAt: number, persist: boolean): CacheEntry | null {
  const bytes = measure(value)
  if (bytes > CACHE_MAX_BYTES) return null

  drop(url)
  const entry: CacheEntry = { value, bytes, storedAt, lastUsed: ++useCounter }
  entries.set(url, entry)
  totalBytes += bytes

  if (persist) writePersisted(url, value, storedAt)

  evictDownTo(CACHE_MAX_BYTES)
  return entries.get(url) ?? null
}

/**
 * Drop cached responses so the next read goes to the network.
 *
 * Call it after a write, or from a refresh control. `invalidate()` with no
 * argument clears everything; a path clears that endpoint and every filtered
 * variant of it.
 */
export function invalidate(path?: string): void {
  clearPersisted(path)

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

export function cacheStats(): { entries: number; bytes: number } {
  return { entries: entries.size, bytes: totalBytes }
}
