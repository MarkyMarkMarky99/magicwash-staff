import type { RouteRecordRaw } from 'vue-router'

export const packageRoutes: RouteRecordRaw[] = [
  {
    path: '/packages',
    name: 'package-list',
    component: () => import('./pages/PackageListPage.vue'),
  },
  {
    path: '/packages/new',
    name: 'package-create',
    component: () => import('./pages/PackageFormPage.vue'),
    meta: { parent: 'package-list' },
  },
  {
    path: '/packages/:packageCode/edit',
    name: 'package-edit',
    component: () => import('./pages/PackageFormPage.vue'),
    meta: { parent: 'package-list' },
    props: true,
  },
]
