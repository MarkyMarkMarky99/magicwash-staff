import type { RouteRecordRaw } from 'vue-router'
import { CUSTOMER_PACKAGE_CREATE_ROUTE_NAME } from '@/shared/navigation/form-routes'

export const customerPackageRoutes: RouteRecordRaw[] = [
  { path: '/customer-packages', name: 'customer-package-list', component: () => import('./pages/CustomerPackageListPage.vue') },
  { path: '/customer-packages/create', name: CUSTOMER_PACKAGE_CREATE_ROUTE_NAME, component: () => import('./pages/CustomerPackageCreatePage.vue'), meta: { parent: 'customer-package-list' } },
  { path: '/customer-packages/:customerPackageId', name: 'customer-package-detail', component: () => import('./pages/CustomerPackageDetailPage.vue'), meta: { parent: 'customer-package-list' }, props: true },
]
