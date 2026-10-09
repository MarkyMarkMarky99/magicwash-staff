import type { RouteRecordRaw } from 'vue-router'

export const jobTicketRoutes: RouteRecordRaw[] = [
  { path: '/departments/:department(logistics)/:orderId', name: 'logistics-order-bags', component: () => import('./pages/LogisticsOrderBagsPage.vue'), meta: { parent: 'department-work' }, props: true },
  { path: '/departments/:department(packaging)/:orderId', name: 'packaging-order-bags', component: () => import('./pages/PackagingOrderBagsPage.vue'), meta: { parent: 'department-work' }, props: true },
  { path: '/departments/:department', name: 'department-work', component: () => import('./pages/DepartmentWorkPage.vue') },
]
