import { computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

export function useOrderOverlayRoute({ queryKey, queryValue }: { queryKey: string; queryValue: string }) {
  const route = useRoute()
  const router = useRouter()
  const isOpen = computed(() => {
    const value = route.query[queryKey]
    return (Array.isArray(value) ? value[0] : value) === queryValue
  })
  let pushedByUs = false

  watch(isOpen, (open) => { if (!open) pushedByUs = false })

  function open() {
    if (isOpen.value) return
    pushedByUs = true
    void router.push({ query: { ...route.query, [queryKey]: queryValue } })
  }

  function close() {
    if (!isOpen.value) return
    if (pushedByUs) {
      pushedByUs = false
      void router.back()
      return
    }
    const query = { ...route.query }
    delete query[queryKey]
    void router.replace({ query })
  }

  return { isOpen, open, close }
}
