import { computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

// Route-owned overlay: a query key that opens on push and closes with Back (docs/conventions/navigation.md).
export function useQueryOverlay(key: string) {
  const route = useRoute()
  const router = useRouter()
  const id = computed<string | null>(() => {
    const raw = route.query[key]
    const first = Array.isArray(raw) ? raw[0] : raw
    return typeof first === 'string' && first.trim() ? first.trim() : null
  })
  let pushedByUs = false

  watch(id, current => { if (current === null) pushedByUs = false })

  function open(target: string): void {
    if (id.value === target) return
    pushedByUs = true
    void router.push({ query: { ...route.query, [key]: target } })
  }

  function change(target: string): void {
    void router.replace({ query: { ...route.query, [key]: target } })
  }

  function close(): void {
    if (id.value === null) return
    if (pushedByUs) {
      pushedByUs = false
      router.back()
      return
    }
    const query = { ...route.query }
    delete query[key]
    void router.replace({ query })
  }

  return { id, open, change, close }
}
