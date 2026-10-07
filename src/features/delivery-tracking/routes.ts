import type { RouteRecordRaw } from 'vue-router'
import { DELIVERY_TRACKING_ROUTE_NAME } from './utils/delivery-tracking'

export const deliveryTrackingRoutes: RouteRecordRaw[] = [
  {
    path: '/b/:orderImageId',
    name: DELIVERY_TRACKING_ROUTE_NAME,
    component: () => import('./pages/DeliveryTrackingPage.vue'),
    meta: { public: true },
  },
]
