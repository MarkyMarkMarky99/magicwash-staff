import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'

export function useLaundryItemDetailOverlayRoute() {
  const route = useRoute()
  const router = useRouter()
  const owned = new Set<string>()
  const value = computed(() => typeof route.query.garmentDetail === 'string' ? route.query.garmentDetail : null)

  function open(next: string, replace = false): void {
    const location = { query: { ...route.query, garmentDetail: next } }
    const path = router.resolve(location).fullPath
    if (!replace || owned.has(route.fullPath)) owned.add(path)
    void (replace ? router.replace(location) : router.push(location))
  }

  function close(): void {
    if (value.value === null) return
    if (owned.has(route.fullPath)) { router.back(); return }
    const query = { ...route.query }
    delete query.garmentDetail
    void router.replace({ query })
  }

  return { value, open, close }
}
