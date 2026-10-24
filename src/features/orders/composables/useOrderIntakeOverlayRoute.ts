import { computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

export type OrderIntakeOverlay =
  | { kind: 'garments' | 'document' | 'weight' | 'belonging' | 'photos' }
  | { kind: 'view', id: string }

const QUERY_KEY = 'intake'
const VIEW_PREFIX = 'view:'
const PLAIN_KINDS = ['garments', 'document', 'weight', 'belonging', 'photos'] as const

export function parseOrderIntakeOverlay(raw: unknown): OrderIntakeOverlay | null {
  const value = Array.isArray(raw) ? raw[0] : raw
  if (typeof value !== 'string') return null
  const plain = PLAIN_KINDS.find((kind) => kind === value)
  if (plain) return { kind: plain }
  if (value.startsWith(VIEW_PREFIX) && value.length > VIEW_PREFIX.length) return { kind: 'view', id: value.slice(VIEW_PREFIX.length) }
  return null
}

export function serializeOrderIntakeOverlay(overlay: OrderIntakeOverlay): string {
  return overlay.kind === 'view' ? `${VIEW_PREFIX}${overlay.id}` : overlay.kind
}

export function useOrderIntakeOverlayRoute() {
  const route = useRoute()
  const router = useRouter()
  const overlay = computed(() => parseOrderIntakeOverlay(route.query[QUERY_KEY]))
  let pushedByUs = false

  watch(overlay, (current) => { if (current === null) pushedByUs = false })

  function withoutOverlay() {
    const query = { ...route.query }
    delete query[QUERY_KEY]
    return query
  }

  function open(next: OrderIntakeOverlay): void {
    const query = { ...route.query, [QUERY_KEY]: serializeOrderIntakeOverlay(next) }
    if (overlay.value !== null) {
      void router.replace({ query })
      return
    }
    pushedByUs = true
    void router.push({ query })
  }

  function close(): void {
    if (overlay.value === null) return
    if (pushedByUs) {
      pushedByUs = false
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
