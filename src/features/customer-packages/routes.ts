import type { RouteRecordRaw } from 'vue-router'

export const customerPackageRoutes: RouteRecordRaw[] = [
  { path: '/customer-packages', name: 'customer-package-list', component: () => import('./pages/CustomerPackageListPage.vue'), meta: { searchable: true } },
  { path: '/customer-packages/create', name: 'customer-package-create', component: () => import('./pages/CustomerPackageCreatePage.vue'), meta: { parent: 'customer-package-list' } },
  { path: '/customer-packages/:customerPackageId', name: 'customer-package-detail', component: () => import('./pages/CustomerPackageDetailPage.vue'), meta: { parent: 'customer-package-list' }, props: true },
]
