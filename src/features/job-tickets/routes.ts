import type { RouteRecordRaw } from 'vue-router'

export const jobTicketRoutes: RouteRecordRaw[] = [
  { path: '/departments/:department', name: 'department-work', component: () => import('./pages/DepartmentWorkPage.vue') },
]
