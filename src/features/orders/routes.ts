import type { RouteRecordRaw } from 'vue-router'
import { ORDER_CREATE_ROUTE_NAME, ORDER_EDIT_ROUTE_NAME } from '@/shared/navigation/form-routes'

export const orderRoutes: RouteRecordRaw[] = [
  { path: '/orders', name: 'order-list', component: () => import('./pages/OrderListPage.vue') },
  { path: '/orders/new', name: ORDER_CREATE_ROUTE_NAME, component: () => import('./pages/OrderCreatePage.vue'), meta: { parent: 'order-list' } },
  { path: '/orders/:orderId/edit', name: ORDER_EDIT_ROUTE_NAME, component: () => import('./pages/OrderCreatePage.vue'), meta: { parent: 'order-list' } },
  { path: '/orders/:orderId/photos', name: 'order-photo-library', component: () => import('./pages/OrderPhotoLibraryPage.vue'), meta: { parent: 'order-list' }, props: true },
  { path: '/orders/:orderId', name: 'order-detail', component: () => import('./pages/OrderDetailPage.vue'), meta: { parent: 'order-list' }, props: true },
]
