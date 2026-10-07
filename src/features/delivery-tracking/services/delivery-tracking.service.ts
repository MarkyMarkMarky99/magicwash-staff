import type { DeliveryTrackingView } from '../delivery-tracking.types'
import { findFixtureView } from './delivery-tracking.fixtures'

const FIXTURE_DELAY_MS = 700

export function fetchDeliveryTracking(orderImageId: string): Promise<DeliveryTrackingView | null> {
  return new Promise((resolve) => {
    setTimeout(() => resolve(findFixtureView(orderImageId)), FIXTURE_DELAY_MS)
  })
}
