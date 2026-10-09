import { createRouter, createWebHashHistory } from 'vue-router'
import { useAuthStore } from '@/data/auth/auth.store'
import { STAFF_REGISTER_ROUTE_NAME } from '@/shared/navigation/form-routes'
import { washQueueRoutes } from '@/features/wash-queue/routes'
import { appointmentRoutes } from '@/features/appointments/routes'
import { invoiceRoutes } from '@/features/invoices/routes'
import { customerRoutes } from '@/features/customers/routes'
import { customerPackageRoutes } from '@/features/customer-packages/routes'
import { galleryRoutes } from '@/features/gallery/routes'
import { priceListRoutes } from '@/features/price-list/routes'
import { packageRoutes } from '@/features/packages/routes'
import { issueReportRoutes } from '@/features/issue-reports/routes'
import { orderRoutes } from '@/features/orders/routes'
import { tagScannerRoutes } from '@/features/tag-scanner/routes'
import { jobTicketRoutes } from '@/features/job-tickets/routes'
import { staffRoutes } from '@/features/staff/routes'
import { orderReportRoutes } from '@/features/order-reports/routes'
import { deliveryTrackingRoutes } from '@/features/delivery-tracking/routes'

const routes = [
  ...washQueueRoutes,
  ...appointmentRoutes,
  ...customerRoutes,
  ...invoiceRoutes,
  ...customerPackageRoutes,
  ...galleryRoutes,
  ...priceListRoutes,
  ...packageRoutes,
  ...issueReportRoutes,
  ...orderRoutes,
  ...tagScannerRoutes,
  ...jobTicketRoutes,
  ...staffRoutes,
  ...orderReportRoutes,
  ...deliveryTrackingRoutes,
]

if (import.meta.env.DEV) {
  routes.push({
    path: '/customer-packages/preview',
    name: 'customer-packages-preview',
    component: () => import('@/features/customer-packages/preview/CustomerPackagesPreviewPage.vue'),
    meta: { parent: 'customer-list' },
  })

  routes.push({
    path: '/dev/form-overlay',
    name: 'form-overlay-preview',
    component: () => import('@/app/dev/FormOverlayPreviewPage.vue'),
  })

  routes.push({
    path: '/dev/overlay-frame',
    name: 'overlay-frame-preview',
    component: () => import('@/app/dev/OverlayFramePreviewPage.vue'),
  })
}

routes.push({
  path: '/login',
  name: 'login',
  component: () => import('@/app/auth/LoginPage.vue'),
})

const router = createRouter({
  history: createWebHashHistory(),
  routes,
})

router.beforeEach(async (to) => {
  if (to.meta.public) return true
  if (to.name === 'login' || to.name === STAFF_REGISTER_ROUTE_NAME) return true
  const authStore = useAuthStore()
  await authStore.ready()
  if (authStore.status === 'signedIn') return true
  return { name: 'login', query: { redirect: to.fullPath } }
})

export default router
