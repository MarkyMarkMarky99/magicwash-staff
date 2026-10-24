import { computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

export type OrderIntakeOverlay =
  | { kind: 'garments' | 'document' | 'weight' | 'belonging' | 'photos' }
  | { kind: 'view', id: string }
  | { kind: 'row', key: string }
  | { kind: 'pick', tag: string }
  | { kind: 'defect', tag: string }
  | { kind: 'item', tag: string }

const QUERY_KEY = 'intake'
const PLAIN_KINDS = ['garments', 'document', 'weight', 'belonging', 'photos'] as const
const VALUE_KINDS = ['view', 'row', 'pick', 'defect', 'item'] as const

export function parseOrderIntakeOverlay(raw: unknown): OrderIntakeOverlay | null {
  const value = Array.isArray(raw) ? raw[0] : raw
  if (typeof value !== 'string') return null
  const plain = PLAIN_KINDS.find((kind) => kind === value)
  if (plain) return { kind: plain }
  for (const kind of VALUE_KINDS) {
    const prefix = `${kind}:`
    if (!value.startsWith(prefix) || value.length === prefix.length) continue
    const rest = value.slice(prefix.length)
    if (kind === 'view') return { kind, id: rest }
    if (kind === 'row') return { kind, key: rest }
    return { kind, tag: rest }
  }
  return null
}

export function serializeOrderIntakeOverlay(overlay: OrderIntakeOverlay): string {
  switch (overlay.kind) {
    case 'view': return `view:${overlay.id}`
    case 'row': return `row:${overlay.key}`
    case 'pick': return `pick:${overlay.tag}`
    case 'defect': return `defect:${overlay.tag}`
    case 'item': return `item:${overlay.tag}`
    default: return overlay.kind
  }
}

export function useOrderIntakeOverlayRoute() {
  const route = useRoute()
  const router = useRouter()
  const overlay = computed(() => parseOrderIntakeOverlay(route.query[QUERY_KEY]))
  const ownedEntries = new Set<string>()

  watch(overlay, (current) => { if (current === null) ownedEntries.clear() })

  function withoutOverlay() {
    const query = { ...route.query }
    delete query[QUERY_KEY]
    return query
  }

  function open(next: OrderIntakeOverlay): void {
    const query = { ...route.query, [QUERY_KEY]: serializeOrderIntakeOverlay(next) }
    const path = router.resolve({ query }).fullPath
    if (overlay.value !== null && next.kind !== 'item') {
      if (ownedEntries.has(route.fullPath)) ownedEntries.add(path)
      void router.replace({ query })
      return
    }
    ownedEntries.add(path)
    void router.push({ query })
  }

  function close(): void {
    if (overlay.value === null) return
    if (ownedEntries.has(route.fullPath)) {
      router.back()
      return
    }
    void router.replace({ query: withoutOverlay() })
  }

  function clear(): void {
    if (overlay.value !== null) void router.replace({ query: withoutOverlay() })
  }

  return { overlay, open, close, clear }
}
