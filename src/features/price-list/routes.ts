import type { RouteRecordRaw } from 'vue-router'

export const priceListRoutes: RouteRecordRaw[] = [
  {
    path: '/price-list',
    name: 'price-list',
    component: () => import('./pages/PriceListPage.vue'),
    meta: { searchable: true },
  },
  {
    path: '/price-list/new',
    name: 'price-list-create',
    component: () => import('./pages/PriceListFormPage.vue'),
    meta: { parent: 'price-list' },
  },
  {
    path: '/price-list/:id/edit',
    name: 'price-list-edit',
    component: () => import('./pages/PriceListFormPage.vue'),
    meta: { parent: 'price-list' },
    props: true,
  },
]
