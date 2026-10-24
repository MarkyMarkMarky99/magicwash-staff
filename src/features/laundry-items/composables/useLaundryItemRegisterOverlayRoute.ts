import { computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

export type LaundryItemRegisterOverlay =
  | { kind: 'camera' }
  | { kind: 'view', id: string }

const QUERY_KEY = 'register'
const VIEW_PREFIX = 'view:'

export function parseLaundryItemRegisterOverlay(raw: unknown): LaundryItemRegisterOverlay | null {
  const value = Array.isArray(raw) ? raw[0] : raw
  if (typeof value !== 'string') return null
  if (value === 'camera') return { kind: 'camera' }
  if (value.startsWith(VIEW_PREFIX) && value.length > VIEW_PREFIX.length) return { kind: 'view', id: value.slice(VIEW_PREFIX.length) }
  return null
}

export function serializeLaundryItemRegisterOverlay(overlay: LaundryItemRegisterOverlay): string {
  return overlay.kind === 'view' ? `${VIEW_PREFIX}${overlay.id}` : overlay.kind
}

export function useLaundryItemRegisterOverlayRoute() {
  const route = useRoute()
  const router = useRouter()
  const overlay = computed(() => parseLaundryItemRegisterOverlay(route.query[QUERY_KEY]))
  let pushedByUs = false

  watch(overlay, (current) => { if (current === null) pushedByUs = false })

  function withoutOverlay() {
    const query = { ...route.query }
    delete query[QUERY_KEY]
    return query
  }

  function open(next: LaundryItemRegisterOverlay): void {
    const query = { ...route.query, [QUERY_KEY]: serializeLaundryItemRegisterOverlay(next) }
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
