import type { RouteRecordRaw } from 'vue-router'

export const washQueueRoutes: RouteRecordRaw[] = [{
  path: '/wash-queue',
  name: 'wash-queue',
  component: () => import('./pages/WashQueuePage.vue'),
}]
