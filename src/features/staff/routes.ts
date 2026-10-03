import type { RouteRecordRaw } from 'vue-router'
import { STAFF_EDIT_ROUTE_NAME, STAFF_PROFILE_ROUTE_NAME, STAFF_REGISTER_ROUTE_NAME } from '@/shared/navigation/form-routes'

export const staffRoutes: RouteRecordRaw[] = [
  {
    path: '/staff',
    name: 'staff-list',
    component: () => import('./pages/StaffListPage.vue'),
  },
  {
    path: '/staff/register',
    name: STAFF_REGISTER_ROUTE_NAME,
    component: () => import('./pages/StaffFormPage.vue'),
  },
  {
    path: '/staff/:staffId',
    name: STAFF_PROFILE_ROUTE_NAME,
    component: () => import('./pages/StaffProfilePage.vue'),
    meta: { parent: 'staff-list' },
    props: true,
  },
  {
    path: '/staff/:staffId/edit',
    name: STAFF_EDIT_ROUTE_NAME,
    component: () => import('./pages/StaffFormPage.vue'),
    meta: { parent: 'staff-list' },
    props: true,
  },
]
