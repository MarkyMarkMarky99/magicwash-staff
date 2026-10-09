import { computed, watch } from 'vue'
import type { LocationQueryRaw } from 'vue-router'
import { useRoute, useRouter } from 'vue-router'
import { parseWeightKg } from '@shared/utils/item-quantity'

// Route-owned weigh-then-photo flow: `?weigh=<target>` opens the weight prompt, `?weight=<kg>` adds the
// camera step, and Back closes both (docs/conventions/navigation.md). Targets: `book` or `unload:<rowId>`.
export function useWeighFlow() {
  const route = useRoute()
  const router = useRouter()
  const first = (value: unknown): string | null => {
    const raw = Array.isArray(value) ? value[0] : value
    return typeof raw === 'string' && raw.trim() ? raw.trim() : null
  }
  const target = computed(() => first(route.query.weigh))
  const weight = computed(() => {
    const raw = first(route.query.weight)
    return raw === null ? null : parseWeightKg(raw)
  })
  const promptOpen = computed(() => target.value !== null && weight.value === null)
  const cameraOpen = computed(() => target.value !== null && weight.value !== null)
  let pushedByUs = false

  watch(target, current => { if (current === null) pushedByUs = false })

  function open(next: string): void {
    const query: LocationQueryRaw = { ...route.query, weigh: next }
    delete query.weight
    if (target.value !== null) {
      void router.replace({ query })
      return
    }
    pushedByUs = true
    void router.push({ query })
  }

  function submit(kg: number): void {
    void router.replace({ query: { ...route.query, weight: String(kg) } })
  }

  function close(): void {
    if (target.value === null) return
    if (pushedByUs) {
      pushedByUs = false
      router.back()
      return
    }
    const query = { ...route.query }
    delete query.weigh
    delete query.weight
    void router.replace({ query })
  }

  return { target, weight, promptOpen, cameraOpen, open, submit, close }
}
