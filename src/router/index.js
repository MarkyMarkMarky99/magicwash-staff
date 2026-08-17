import { createRouter, createWebHashHistory } from 'vue-router'
import { appointmentRoutes } from '@/features/appointments/routes'
import { invoiceRoutes } from '@/features/invoices/routes'
import { customerRoutes } from '@/features/customers/routes'
import { customerPackagePreviewRoutes } from '@/features/customer-packages/preview/routes'
import { galleryRoutes } from '@/features/gallery/routes'

const routes = [
  ...appointmentRoutes,
  ...customerRoutes,
  ...invoiceRoutes,
  ...customerPackagePreviewRoutes,
  ...galleryRoutes,
]

export default createRouter({
  history: createWebHashHistory(),
  routes,
})
