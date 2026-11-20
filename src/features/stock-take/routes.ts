import type { RouteRecordRaw } from 'vue-router'
import { useAuthStore } from '@/data/auth/auth.store'

async function adminOnly() {
  const authStore = useAuthStore()
  await authStore.ready()
  return authStore.isAdmin ? true : { name: 'stock-take-count', replace: true }
}

export const stockTakeRoutes: RouteRecordRaw[] = [
  {
    path: '/stock-take',
    name: 'stock-take-count',
    component: () => import('./pages/StockTakeCountPage.vue'),
    meta: { ownsWorkScan: true },
  },
  {
    path: '/stock-take/manage',
    name: 'stock-take-manage',
    component: () => import('./pages/StockTakeManagePage.vue'),
    meta: { parent: 'stock-take-count' },
    beforeEnter: adminOnly,
  },
]
