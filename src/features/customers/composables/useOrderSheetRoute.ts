import { computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const QUERY_KEY = 'order'

export function useOrderSheetRoute() {
  const route = useRoute()
  const router = useRouter()

  // The URL is the single source of truth for which order sheet is open.
  const openOrderId = computed<string | null>(() => {
    const raw = route.query[QUERY_KEY]
    const value = Array.isArray(raw) ? raw[0] : raw
    return typeof value === 'string' && value.trim() ? value.trim() : null
  })

  // True only when THIS page pushed the current sheet entry. A deep link or a
  // refresh lands on the sheet with no entry of ours behind it, and calling
  // router.back() there would leave the app entirely.
  let pushedByUs = false

  watch(openOrderId, (value) => {
    if (value === null) pushedByUs = false
  })

  function open(orderId: string | null | undefined) {
    const id = orderId?.trim()
    if (!id || openOrderId.value === id) return
    pushedByUs = true
    router.push({ query: { ...route.query, [QUERY_KEY]: id } })
  }

  function close() {
    if (openOrderId.value === null) return
    if (pushedByUs) {
      pushedByUs = false
      router.back()
      return
    }
    const query = { ...route.query }
    delete query[QUERY_KEY]
    router.replace({ query })
  }

  return { openOrderId, open, close }
}
