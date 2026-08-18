import type { RouteRecordRaw } from 'vue-router'

export const customerPackagePreviewRoutes: RouteRecordRaw[] = [
  {
    path: '/customer-packages/preview',
    name: 'customer-packages-preview',
    component: () => import('./CustomerPackagesPreviewPage.vue'),
    meta: { parent: 'customer-list' },
  },
]
