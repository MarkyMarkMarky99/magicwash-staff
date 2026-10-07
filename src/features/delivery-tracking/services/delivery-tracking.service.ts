import { ApiError, apiGet } from '@/shared/api/api-client'
import type { DeliveryTrackingView } from '../delivery-tracking.types'

export async function fetchDeliveryTracking(orderImageId: string): Promise<DeliveryTrackingView | null> {
  try {
    return await apiGet<DeliveryTrackingView>(`/api/delivery-tracking/${encodeURIComponent(orderImageId)}`)
  } catch (error) {
    if (!(error instanceof ApiError && error.status === 404)) console.error('Delivery tracking load failed', error)
    return null
  }
}
