import { computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const QUERY_KEY = 'buyPackage'

export function useCustomerPackageBuyRoute() {
  const route = useRoute()
  const router = useRouter()
  const isOpen = computed(() => route.query[QUERY_KEY] === '1')
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
