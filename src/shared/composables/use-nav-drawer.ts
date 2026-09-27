import { computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const QUERY_KEY = 'menu'
let pushedByUs = false

export function useNavDrawer() {
  const route = useRoute()
  const router = useRouter()
  const isOpen = computed(() => route.query[QUERY_KEY] === '1')

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
      router.back()
      return
    }
    const query = { ...route.query }
    delete query[QUERY_KEY]
    void router.replace({ query })
  }

  function toggle() {
    if (isOpen.value) close()
    else open()
  }

  return { isOpen, open, close, toggle }
}
