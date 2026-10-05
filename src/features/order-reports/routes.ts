import type { RouteRecordRaw } from 'vue-router'
import { ORDER_REPORT_ROUTE_NAME } from './utils/order-report'

export const orderReportRoutes: RouteRecordRaw[] = [
  { path: '/reports/orders', name: ORDER_REPORT_ROUTE_NAME, component: () => import('./pages/OrderReportPage.vue'), meta: { parent: 'order-list' } },
]
