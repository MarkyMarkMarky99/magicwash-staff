import { computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

export type SlipOverlay =
  | { kind: 'scan', retakeId: string | null }
  | { kind: 'view', id: string }

const SLIP_QUERY_KEY = 'slip'
const SCAN_VALUE = 'scan'
const RETAKE_PREFIX = 'retake:'
const VIEW_PREFIX = 'view:'

export function parseSlipOverlay(raw: unknown): SlipOverlay | null {
  const value = Array.isArray(raw) ? raw[0] : raw
  if (typeof value !== 'string') return null
  if (value === SCAN_VALUE) return { kind: 'scan', retakeId: null }
  if (value.startsWith(RETAKE_PREFIX) && value.length > RETAKE_PREFIX.length) return { kind: 'scan', retakeId: value.slice(RETAKE_PREFIX.length) }
  if (value.startsWith(VIEW_PREFIX) && value.length > VIEW_PREFIX.length) return { kind: 'view', id: value.slice(VIEW_PREFIX.length) }
  return null
}

export function serializeSlipOverlay(overlay: SlipOverlay): string {
  if (overlay.kind === 'view') return `${VIEW_PREFIX}${overlay.id}`
  return overlay.retakeId === null ? SCAN_VALUE : `${RETAKE_PREFIX}${overlay.retakeId}`
}

export function useSlipOverlayRoute() {
  const route = useRoute()
  const router = useRouter()
  const overlay = computed(() => parseSlipOverlay(route.query[SLIP_QUERY_KEY]))
  let pushedByUs = false

  watch(overlay, (current) => { if (current === null) pushedByUs = false })

  function withoutSlip() {
    const query = { ...route.query }
    delete query[SLIP_QUERY_KEY]
    return query
  }

  function open(next: SlipOverlay): void {
    const query = { ...route.query, [SLIP_QUERY_KEY]: serializeSlipOverlay(next) }
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
    void router.replace({ query: withoutSlip() })
  }

  function clear(): void {
    if (overlay.value !== null) void router.replace({ query: withoutSlip() })
  }

  return { overlay, open, close, clear }
}
