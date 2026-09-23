import type { RouteRecordRaw } from 'vue-router'

export const tagScannerRoutes: RouteRecordRaw[] = [
  {
    path: '/tag-scanner',
    name: 'tag-scanner-prototype',
    component: () => import('./pages/TagScannerPrototypePage.vue'),
  },
  {
    path: '/scan-benchmark',
    name: 'scan-benchmark',
    component: () => import('./pages/ScanBenchmarkPage.vue'),
  },
]
