import { computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const QUERY_KEY = 'billingPhoto'

export function useBillingPhotoRoute() {
  const route = useRoute()
  const router = useRouter()

  const openPhotoId = computed<string | null>(() => {
    const raw = route.query[QUERY_KEY]
    const value = Array.isArray(raw) ? raw[0] : raw
    return typeof value === 'string' && value ? value : null
  })

  let pushedByUs = false

  watch(openPhotoId, (value) => {
    if (value === null) pushedByUs = false
  })

  function open(id: string, replace = false) {
    if (openPhotoId.value === id) return
    const location = { query: { ...route.query, [QUERY_KEY]: id } }
    if (replace && openPhotoId.value !== null) {
      router.replace(location)
      return
    }
    pushedByUs = true
    router.push(location)
  }

  function close() {
    if (openPhotoId.value === null) return
    if (pushedByUs) {
      pushedByUs = false
      router.back()
      return
    }
    const query = { ...route.query }
    delete query[QUERY_KEY]
    router.replace({ query })
  }

  return { openPhotoId, open, close }
}
