import { computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

export function useQueryOverlay(key: string, isActive: () => boolean) {
  const route = useRoute()
  const router = useRouter()
  const id = computed<string | null>(() => {
    if (!isActive()) return null
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

  return { id, open, close }
}
