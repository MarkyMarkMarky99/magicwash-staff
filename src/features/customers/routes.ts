import type { RouteRecordRaw } from 'vue-router'

export const customerRoutes: RouteRecordRaw[] = [
  {
    path: '/customers',
    name: 'customer-list',
    component: () => import('./pages/CustomerListPage.vue'),
  },
  {
    path: '/customers/new',
    name: 'customer-create',
    component: () => import('./pages/CustomerCreatePage.vue'),
    meta: { parent: 'customer-list' },
  },
  {
    path: '/customers/:customerId/orders',
    name: 'customer-order-history',
    component: () => import('./pages/CustomerOrderHistoryPage.vue'),
    meta: { parent: 'customer-list' },
    props: true,
  },
]
