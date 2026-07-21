const BASE62 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'

/**
 * Generate a random base62 id (default 8 chars).
 * Suitable for resource ids; not cryptographically secure.
 */
export function generateId(length = 8): string {
  let id = ''
  for (let i = 0; i < length; i += 1) {
    id += BASE62[Math.floor(Math.random() * BASE62.length)]
  }
  return id
}
