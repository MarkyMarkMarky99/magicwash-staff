import { PERSIST_MAX_BYTES } from '@/shared/config/cache'

/**
 * `localStorage` half of the response cache, behind {@link readCache}.
 *
 * Only endpoints the policy marks `persist` reach this layer, and only so a page
 * reload paints from a stored copy instead of an empty screen. The in-memory map
 * stays the fast path; this is consulted once per URL, on the first miss.
 *
 * Every call is wrapped in `try`/`catch` on purpose. `localStorage` throws rather
 * than returning empty in private browsing and under a full quota, and a cache is
 * never worth failing a read over: on any error the caller carries on with the
 * in-memory layer alone.
 */

/**
 * Bump when the stored shape changes. Entries written under any other version are
 * deleted on startup, so a deploy that changes what `apiGet` returns can never
 * hand returning staff a response the new code cannot read.
 */
const STORAGE_VERSION = 1

const NAMESPACE = 'mw-cache'
const PREFIX = `${NAMESPACE}:${STORAGE_VERSION}:`

interface StoredEntry {
  /** The unwrapped response value, exactly as the in-memory layer holds it. */
  v: unknown
  /** Epoch ms the response was received, so freshness survives the reload. */
  t: number
}

/**
 * `localStorage` is absent in Node (the dry tests) and can throw on access alone
 * when site data is blocked, so it is never touched directly.
 */
function storage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

function ourKeys(store: Storage): string[] {
  const keys: string[] = []
  for (let i = 0; i < store.length; i += 1) {
    const key = store.key(i)
    if (key !== null && key.startsWith(`${NAMESPACE}:`)) keys.push(key)
  }
  return keys
}

/**
 * Drop everything written under a different {@link STORAGE_VERSION}.
 *
 * Called once when the module loads. Enumerating keys is cheap; nothing is parsed.
 */
function purgeOtherVersions(): void {
  const store = storage()
  if (store === null) return

  try {
    for (const key of ourKeys(store)) {
      if (!key.startsWith(PREFIX)) store.removeItem(key)
    }
  } catch {
    // Nothing to recover: the stale entries stay, and a shape mismatch is caught
    // by the parse guard in readPersisted below.
  }
}

purgeOtherVersions()

export interface PersistedEntry {
  value: unknown
  /** Epoch ms the response was originally received, not when it was read back. */
  storedAt: number
}

/** Read one stored response, or `null` when nothing usable is there. */
export function readPersisted(url: string): PersistedEntry | null {
  const store = storage()
  if (store === null) return null

  try {
    const raw = store.getItem(PREFIX + url)
    if (raw === null) return null

    const parsed = JSON.parse(raw) as StoredEntry
    if (parsed === null || typeof parsed !== 'object' || typeof parsed.t !== 'number') {
      store.removeItem(PREFIX + url)
      return null
    }

    return { value: parsed.v, storedAt: parsed.t }
  } catch {
    // Corrupt JSON, or a quota error on the read path in some browsers. Either
    // way the entry is unusable; leave it to the next write or version purge.
    return null
  }
}

/**
 * Store one response, keeping the persisted total under its own ceiling.
 *
 * The budget is separate from the in-memory one: `localStorage` is shared with
 * the rest of the origin and its quota is per-browser, so the cache must not
 * spend all of it. When a write still fails on quota, older persisted entries are
 * dropped and the write is tried once more.
 */
export function writePersisted(url: string, value: unknown, storedAt: number): void {
  const store = storage()
  if (store === null) return

  let payload: string
  try {
    payload = JSON.stringify({ v: value, t: storedAt } satisfies StoredEntry)
  } catch {
    return
  }

  if (payload.length > PERSIST_MAX_BYTES) return

  evictPersistedDownTo(PERSIST_MAX_BYTES - payload.length, url)

  try {
    store.setItem(PREFIX + url, payload)
  } catch {
    // Quota, or a browser that reports storage but refuses to write to it. One
    // retry with everything else cleared, then give up and stay in memory only.
    try {
      clearPersisted()
      store.setItem(PREFIX + url, payload)
    } catch {
      // In-memory caching still works; a reload simply starts cold.
    }
  }
}

/**
 * Drop the oldest persisted entries until the remaining ones fit in `limit`.
 *
 * Eviction is by stored age rather than last use: `localStorage` records no reads,
 * and for the near-static lists that qualify for persistence the oldest copy is
 * also the one most likely to be wrong.
 */
function evictPersistedDownTo(limit: number, excludeUrl: string): void {
  const store = storage()
  if (store === null) return

  try {
    const held = ourKeys(store)
      .filter((key) => key !== PREFIX + excludeUrl)
      .map((key) => {
        const raw = store.getItem(key) ?? ''
        let storedAt = 0
        try {
          storedAt = (JSON.parse(raw) as StoredEntry).t ?? 0
        } catch {
          // Unparseable entries sort first and are evicted first.
        }
        return { key, bytes: raw.length, storedAt }
      })

    let total = held.reduce((sum, entry) => sum + entry.bytes, 0)
    if (total <= limit) return

    for (const entry of held.sort((a, b) => a.storedAt - b.storedAt)) {
      if (total <= limit) return
      store.removeItem(entry.key)
      total -= entry.bytes
    }
  } catch {
    // Leave the store as it is; the write below will hit quota and retry.
  }
}

/**
 * Remove persisted entries for one endpoint, or all of them when called with no
 * argument. Mirrors `invalidate()` on the in-memory layer, including the rule
 * that a path clears its nested and query-string variants.
 */
export function clearPersisted(path?: string): void {
  const store = storage()
  if (store === null) return

  try {
    if (path === undefined) {
      for (const key of ourKeys(store)) store.removeItem(key)
      return
    }

    const pathname = path.split('?')[0] ?? path
    for (const key of ourKeys(store)) {
      const url = key.slice(PREFIX.length)
      const keyPath = url.split('?')[0] ?? url
      if (keyPath === pathname || keyPath.startsWith(`${pathname}/`)) store.removeItem(key)
    }
  } catch {
    // A cache that cannot be cleared is still only a cache; the memory layer was
    // already cleared by the caller, so the next read revalidates regardless.
  }
}

/** Persisted footprint, for tests and diagnostics. */
export function persistedStats(): { entries: number; bytes: number } {
  const store = storage()
  if (store === null) return { entries: 0, bytes: 0 }

  try {
    const keys = ourKeys(store).filter((key) => key.startsWith(PREFIX))
    const bytes = keys.reduce((sum, key) => sum + (store.getItem(key)?.length ?? 0), 0)
    return { entries: keys.length, bytes }
  } catch {
    return { entries: 0, bytes: 0 }
  }
}
