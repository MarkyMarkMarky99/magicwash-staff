import { computed, watch } from 'vue'
import { useRoute, useRouter, type LocationQueryRaw } from 'vue-router'

export function useRouteViewer(queryKey: string, openValue: string) {
  const route = useRoute()
  const router = useRouter()
  const isOpen = computed(() => {
    const raw = route.query[queryKey]
    return (Array.isArray(raw) ? raw[0] : raw) === openValue
  })
  let pushedByUs = false

  watch(isOpen, (open) => { if (!open) pushedByUs = false })

  function withKey(value: string | null): LocationQueryRaw {
    const query: LocationQueryRaw = { ...route.query }
    if (value === null) delete query[queryKey]
    else query[queryKey] = value
    return query
  }

  function open() {
    if (isOpen.value) return
    void router.push({ query: withKey(openValue) }).then(() => {
      pushedByUs = isOpen.value
    }).catch(() => {
      pushedByUs = false
    })
  }

  function close() {
    if (!isOpen.value) return
    if (pushedByUs) {
      pushedByUs = false
      router.back()
      return
    }
    void router.replace({ query: withKey(null) })
  }

  return { isOpen, open, close }
}
