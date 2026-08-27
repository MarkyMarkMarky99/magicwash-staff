import { computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const QUERY_KEY = 'transaction'

export function useCustomerPackageTransactionRoute() {
  const route = useRoute()
  const router = useRouter()

  // Keep the overlay state in the URL so browser Back can dismiss it.
  const isOpen = computed(() => {
    const value = route.query[QUERY_KEY]
    return Array.isArray(value) ? value.length > 0 : value !== undefined
  })

  // A deep link has no overlay entry created by this page, so closing it must
  // replace the query instead of navigating away from the package detail page.
  let pushedByUs = false

  watch(isOpen, (open) => {
    if (!open) pushedByUs = false
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
      void router.back()
      return
    }

    const query = { ...route.query }
    delete query[QUERY_KEY]
    void router.replace({ query })
  }

  return { isOpen, open, close }
}
