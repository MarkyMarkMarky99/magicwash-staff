import type { RouteRecordRaw } from 'vue-router'

export const orderRoutes: RouteRecordRaw[] = [
  { path: '/orders', name: 'order-list', component: () => import('./pages/OrderListPage.vue'), meta: { searchable: true } },
  { path: '/orders/new', name: 'order-create', component: () => import('./pages/OrderCreatePage.vue'), meta: { parent: 'order-list' } },
  { path: '/orders/:orderId', name: 'order-detail', component: () => import('./pages/OrderDetailPage.vue'), meta: { parent: 'order-list' }, props: true },
]
