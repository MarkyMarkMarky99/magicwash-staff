import { computed, watch } from 'vue'
import type { LocationQuery, LocationQueryRaw } from 'vue-router'
import { useRoute, useRouter } from 'vue-router'
import type { OrderImageType } from '@/features/orders/order-image-labels'

export type OrderOverlay = 'item' | 'photo-weight' | 'photo-belonging' | 'photo-document'

const OVERLAY_VALUES: readonly OrderOverlay[] = ['item', 'photo-weight', 'photo-belonging', 'photo-document']
export const overlayToImageType = { 'photo-weight': 'WEIGHT', 'photo-belonging': 'BELONGING', 'photo-document': 'DOCUMENT' } as const satisfies Record<Exclude<OrderOverlay, 'item'>, OrderImageType>
export const imageTypeToOverlay = { WEIGHT: 'photo-weight', BELONGING: 'photo-belonging', DOCUMENT: 'photo-document' } as const satisfies Record<OrderImageType, Exclude<OrderOverlay, 'item'>>

const OVERLAY_QUERY_KEY = 'orderAction'
const LEGACY_ITEM_QUERY_KEY = 'item'
const LEGACY_CAPTURE_QUERY_KEY = 'capture'
const WEIGHT_QUERY_KEY = 'weight'
export const MAX_ORDER_IMAGE_WEIGHT_KG = 200

function readFirstQueryValue(value: unknown): string | null {
  const firstValue = Array.isArray(value) ? value[0] : value
  return typeof firstValue === 'string' ? firstValue : null
}

export function readOrderOverlay(query: LocationQuery): OrderOverlay | null {
  const overlay = readFirstQueryValue(query[OVERLAY_QUERY_KEY])
  if (overlay !== null && (OVERLAY_VALUES as readonly string[]).includes(overlay)) return overlay as OrderOverlay

  // Keep old item-form deep links usable.
  if (readFirstQueryValue(query[LEGACY_ITEM_QUERY_KEY]) === 'new') return 'item'
  return null
}

export function buildOrderOverlayQuery(query: LocationQuery, overlay: OrderOverlay | null): LocationQueryRaw {
  const nextQuery: LocationQueryRaw = { ...query }
  delete nextQuery[OVERLAY_QUERY_KEY]
  delete nextQuery[LEGACY_ITEM_QUERY_KEY]
  delete nextQuery[LEGACY_CAPTURE_QUERY_KEY]
  delete nextQuery[WEIGHT_QUERY_KEY]
  if (overlay) nextQuery[OVERLAY_QUERY_KEY] = overlay
  return nextQuery
}

export function parseOrderImageWeight(raw: string): number | null {
  const trimmed = raw.trim()
  if (trimmed === '') return null
  const parsed = Number(trimmed)
  if (!Number.isFinite(parsed)) return null
  if (parsed <= 0) return null
  if (parsed > MAX_ORDER_IMAGE_WEIGHT_KG) return null
  return Math.round(parsed * 100) / 100
}

export function readOrderImageWeight(query: LocationQuery): number | null {
  const raw = readFirstQueryValue(query[WEIGHT_QUERY_KEY])
  if (raw === null) return null
  return parseOrderImageWeight(raw)
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

  function setWeight(weight: number): void {
    void router.replace({ query: { ...route.query, [WEIGHT_QUERY_KEY]: String(weight) } })
  }

  return { activeOverlay, isItemOpen, open, close, setWeight }
}
