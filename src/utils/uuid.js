export function uuid8() {
  return globalThis.crypto?.randomUUID?.().replace(/-/g, '').slice(0, 8)
    ?? Math.random().toString(16).slice(2, 10).padEnd(8, '0')
}
