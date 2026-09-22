import type { RouteRecordRaw } from 'vue-router'
import { PRICE_LIST_ITEM_CREATE_ROUTE_NAME } from '@/shared/navigation/form-routes'

export const priceListRoutes: RouteRecordRaw[] = [
  {
    path: '/price-list',
    name: 'price-list',
    component: () => import('./pages/PriceListPage.vue'),
  },
  {
    path: '/price-list/new',
    name: 'price-list-create',
    component: () => import('./pages/PriceListFormPage.vue'),
    meta: { parent: 'price-list' },
  },
  {
    path: '/price-list/items/new',
    name: PRICE_LIST_ITEM_CREATE_ROUTE_NAME,
    component: () => import('./pages/PriceListItemCreatePage.vue'),
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
