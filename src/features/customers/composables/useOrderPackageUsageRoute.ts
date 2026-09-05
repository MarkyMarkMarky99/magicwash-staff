import { computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const QUERY_KEY = 'packageUsage'

export function useOrderPackageUsageRoute() {
  const route = useRoute()
  const router = useRouter()
  const isOpen = computed(() => {
    const raw = route.query[QUERY_KEY]
    return (Array.isArray(raw) ? raw[0] : raw) === '1'
  })
  let pushedByUs = false

  watch(isOpen, (value) => {
    if (!value) pushedByUs = false
  })

  function open() {
    if (isOpen.value) return
    pushedByUs = true
    router.push({ query: { ...route.query, [QUERY_KEY]: '1' } })
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
    router.replace({ query })
  }

  return { isOpen, open, close }
}
