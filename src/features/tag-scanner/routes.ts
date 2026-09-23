import type { RouteRecordRaw } from 'vue-router'

export const tagScannerRoutes: RouteRecordRaw[] = [
  {
    path: '/tag-scanner',
    name: 'tag-scanner-prototype',
    component: () => import('./pages/TagScannerPrototypePage.vue'),
  },
]
