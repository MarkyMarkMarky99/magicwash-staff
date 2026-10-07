import { ref, watch, type Ref } from 'vue'
import type { DeliveryTrackingView } from '../delivery-tracking.types'
import { fetchDeliveryTracking } from '../services/delivery-tracking.service'

export type DeliveryTrackingStatus = 'loading' | 'ready' | 'notFound'

export function useDeliveryTracking(orderImageId: Ref<string>) {
  const status = ref<DeliveryTrackingStatus>('loading')
  const view = ref<DeliveryTrackingView | null>(null)
  let sequence = 0

  async function load(id: string) {
    const current = ++sequence
    status.value = 'loading'
    view.value = null
    const result = await fetchDeliveryTracking(id)
    if (current !== sequence) return
    view.value = result
    status.value = result ? 'ready' : 'notFound'
  }

  watch(orderImageId, load, { immediate: true })

  return { status, view }
}
