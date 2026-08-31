import { computed, watch } from 'vue'
import type { LocationQuery, LocationQueryRaw } from 'vue-router'
import { useRoute, useRouter } from 'vue-router'

export type OrderOverlay = 'item'

const OVERLAY_QUERY_KEY = 'orderAction'
const LEGACY_ITEM_QUERY_KEY = 'item'
const LEGACY_CAPTURE_QUERY_KEY = 'capture'

function readFirstQueryValue(value: unknown): string | null {
  const firstValue = Array.isArray(value) ? value[0] : value
  return typeof firstValue === 'string' ? firstValue : null
}

export function readOrderOverlay(query: LocationQuery): OrderOverlay | null {
  const overlay = readFirstQueryValue(query[OVERLAY_QUERY_KEY])
  if (overlay === 'item') return overlay

  // Keep old item-form deep links usable.
  if (readFirstQueryValue(query[LEGACY_ITEM_QUERY_KEY]) === 'new') return 'item'
  return null
}

export function buildOrderOverlayQuery(query: LocationQuery, overlay: OrderOverlay | null): LocationQueryRaw {
  const nextQuery: LocationQueryRaw = { ...query }
  delete nextQuery[OVERLAY_QUERY_KEY]
  delete nextQuery[LEGACY_ITEM_QUERY_KEY]
  delete nextQuery[LEGACY_CAPTURE_QUERY_KEY]
  if (overlay) nextQuery[OVERLAY_QUERY_KEY] = overlay
  return nextQuery
}

export function useOrderOverlayRoute() {
  const route = useRoute()
  const router = useRouter()
  const activeOverlay = computed(() => readOrderOverlay(route.query))
  const isItemOpen = computed(() => activeOverlay.value === 'item')
  let pushedByUs = false

  watch(activeOverlay, (overlay) => { if (overlay === null) pushedByUs = false })

  function open(overlay: OrderOverlay) {
    if (activeOverlay.value === overlay) return

    const query = buildOrderOverlayQuery(route.query, overlay)
    if (activeOverlay.value !== null) {
      void router.replace({ query })
      return
    }

    pushedByUs = false
    void router.push({ query }).then(() => {
      pushedByUs = activeOverlay.value === overlay
    }).catch(() => {
      pushedByUs = false
    })
  }

  function close() {
    if (activeOverlay.value === null) return
    if (pushedByUs) {
      pushedByUs = false
      void router.back()
      return
    }

    void router.replace({ query: buildOrderOverlayQuery(route.query, null) })
  }

  return { activeOverlay, isItemOpen, open, close }
}
