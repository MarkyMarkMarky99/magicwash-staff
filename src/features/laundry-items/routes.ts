import type { RouteRecordRaw } from 'vue-router'
import { LAUNDRY_ITEM_REGISTER_ROUTE_NAME } from '@/shared/navigation/form-routes'

export const laundryItemRoutes: RouteRecordRaw[] = [
  {
    path: '/garments/:tagId',
    name: 'laundry-item-detail',
    component: () => import('./pages/LaundryItemDetailPage.vue'),
    meta: { parent: 'customer-list' },
  },
  {
    path: '/customers/:customerId/garments/register',
    name: LAUNDRY_ITEM_REGISTER_ROUTE_NAME,
    component: () => import('./pages/LaundryItemRegisterPage.vue'),
    meta: { parent: 'customer-detail', ownsWorkScan: true },
  },
]
