import { defineStore } from 'pinia'
import { onScopeDispose, ref } from 'vue'
import { onCacheInvalidated } from '@/shared/api/response-cache'
import { getOrderSnapshot, type OrderSnapshotDto } from './order-snapshot.service'

export const useOrderSnapshotStore = defineStore('order-snapshots', () => {
  const orders = ref<OrderSnapshotDto[] | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)
  let inFlight: Promise<void> | null = null
  let requestSequence = 0

  function load(): Promise<void> {
    return inFlight ?? reload()
  }

  // A write may land while an older request is in flight; its result would predate the
  // write, so invalidation always starts a new request and the sequence drops the old one.
  function reload(): Promise<void> {
    const sequence = ++requestSequence
    loading.value = true
    error.value = null
    inFlight = (async () => {
      try {
        const result = await getOrderSnapshot(sequence)
        if (sequence === requestSequence) orders.value = result
      } catch (reason) {
        if (sequence === requestSequence) {
          error.value = reason instanceof Error && reason.message ? reason.message : 'Could not load orders'
        }
      } finally {
        if (sequence === requestSequence) {
          loading.value = false
          inFlight = null
        }
      }
    })()
    return inFlight
  }

  const stopInvalidationListener = onCacheInvalidated('/api/work-orders', () => void reload())
  onScopeDispose(stopInvalidationListener)

  return { orders, loading, error, load }
})
