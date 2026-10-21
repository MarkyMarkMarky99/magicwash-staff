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
    component: () => import('./pages/CustomerFormPage.vue'),
    meta: { parent: 'customer-list' },
  },
  {
    path: '/customers/:customerId/edit',
    name: 'customer-edit',
    component: () => import('./pages/CustomerFormPage.vue'),
    meta: { parent: 'customer-list' },
    props: true,
  },
  {
    path: '/customers/:customerId/:tab?',
    name: 'customer-detail',
    component: () => import('./pages/CustomerDetailPage.vue'),
    meta: { parent: 'customer-list' },
    props: true,
  },
]
