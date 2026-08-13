import { createRouter, createWebHashHistory } from 'vue-router'
import OrderGalleryPage from '../pages/OrderGalleryPage.vue'
import { appointmentRoutes } from '@/features/appointments/routes'
import { invoiceRoutes } from '@/features/invoices/routes'
import { customerRoutes } from '@/features/customers/routes'
import { customerPackagePreviewRoutes } from '@/features/customer-packages/preview/routes'

const routes = [
  ...appointmentRoutes,
  ...customerRoutes,
  ...invoiceRoutes,
  ...customerPackagePreviewRoutes,
  { path: '/gallery/:key/camera', component: OrderGalleryPage, meta: { openCamera: true } },
  { path: '/gallery/:key', component: OrderGalleryPage },
  { path: '/orders/:orderId/gallery/camera', redirect: to => ({ path: `/gallery/AFT-${to.params.orderId}/camera`, query: to.query }) },
  { path: '/orders/:orderId/gallery', redirect: to => ({ path: `/gallery/AFT-${to.params.orderId}`, query: to.query }) },
]

export default createRouter({
  history: createWebHashHistory(),
  routes,
})
