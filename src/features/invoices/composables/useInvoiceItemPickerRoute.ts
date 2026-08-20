import { computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const QUERY_KEY = 'itemPicker'

/**
 * Route-driven open state for the invoice price-list picker overlay.
 *
 * Mirrors `useOrderSheetRoute`: the URL query is the single source of truth
 * (never mirrored into a local `ref` — a stale mirror on a KeepAlive page
 * would make reopening a silent no-op). Opens with `router.push` so Android
 * Back / the overlay close button can undo the entry; falls back to
 * `router.replace` stripping the param on a deep link or refresh, where
 * `router.back()` would leave the app.
 *
 * The overlay itself must never call `history.pushState` / `back` / `popstate`.
 */
export function useInvoiceItemPickerRoute() {
  const route = useRoute()
  const router = useRouter()

  const isOpen = computed(() => {
    const raw = route.query[QUERY_KEY]
    const value = Array.isArray(raw) ? raw[0] : raw
    return typeof value === 'string' && value.trim() !== '' && value !== '0' && value !== 'false'
  })

  // True only when THIS page pushed the current picker entry.
  let pushedByUs = false

  watch(isOpen, (value) => {
    if (!value) pushedByUs = false
  })

  function open() {
    if (isOpen.value) return
    pushedByUs = true
    void router.push({ query: { ...route.query, [QUERY_KEY]: '1' } })
  }

  function close() {
    if (!isOpen.value) return
    if (pushedByUs) {
      pushedByUs = false
      router.back()
      return
    }
    const query = { ...route.query }
    delete query[QUERY_KEY]
    void router.replace({ query })
  }

  return { isOpen, open, close }
}
