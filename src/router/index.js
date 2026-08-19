import { createRouter, createWebHashHistory } from 'vue-router'
import { appointmentRoutes } from '@/features/appointments/routes'
import { invoiceRoutes } from '@/features/invoices/routes'
import { customerRoutes } from '@/features/customers/routes'
import { customerPackagePreviewRoutes } from '@/features/customer-packages/preview/routes'
import { galleryRoutes } from '@/features/gallery/routes'
import { priceListRoutes } from '@/features/price-list/routes'

const routes = [
  ...appointmentRoutes,
  ...customerRoutes,
  ...invoiceRoutes,
  ...customerPackagePreviewRoutes,
  ...galleryRoutes,
  ...priceListRoutes,
]

export default createRouter({
  history: createWebHashHistory(),
  routes,
})
