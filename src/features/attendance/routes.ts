import type { RouteRecordRaw } from 'vue-router'

export const attendanceRoutes: RouteRecordRaw[] = [
  {
    path: '/attendance',
    name: 'attendance',
    component: () => import('./pages/AttendancePage.vue'),
  },
]
