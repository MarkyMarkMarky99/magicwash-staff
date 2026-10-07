import type { RouteLoader } from '../shared/http/gateway.types.js'
import { ApiError } from '../shared/http/api-error.js'

export const routeRegistry = {
  staff: (): ReturnType<RouteLoader> =>
    import('../modules/staff/staff.module.js').then((module) => module.staffRoutes),
  portal: (): ReturnType<RouteLoader> =>
    import('../modules/portal/portal.module.js').then((module) => module.portalRoutes),
  'delivery-tracking': (): ReturnType<RouteLoader> =>
    import('../modules/delivery-tracking/delivery-tracking.module.js').then(
      (module) => module.deliveryTrackingRoutes,
    ),
  auth: (): ReturnType<RouteLoader> =>
    import('../modules/auth/auth.module.js').then((module) => module.authRoutes),
  appointments: (): ReturnType<RouteLoader> =>
    import('../modules/appointments/appointment.module.js').then((module) => module.appointmentRoutes),
  customers: (): ReturnType<RouteLoader> =>
    import('../modules/customers/customer.module.js').then((module) => module.customerRoutes),
  orders: (): ReturnType<RouteLoader> =>
    import('../modules/orders/order.module.js').then((module) => module.orderRoutes),
  invoices: (): ReturnType<RouteLoader> =>
    import('../modules/invoices/invoice.module.js').then((module) => module.invoiceRoutes),
  payments: (): ReturnType<RouteLoader> =>
    import('../modules/payments/payment.module.js').then((module) => module.paymentRoutes),
  'invoice-prints': (): ReturnType<RouteLoader> =>
    import('../modules/invoice-prints/invoice-print.module.js').then(
      (module) => module.invoicePrintRoutes,
    ),
  'laundry-tag-prints': (): ReturnType<RouteLoader> =>
    import('../modules/laundry-tag-prints/laundry-tag-print.module.js').then(
      (module) => module.laundryTagPrintRoutes,
    ),
  'customer-packages': (): ReturnType<RouteLoader> =>
    import('../modules/customer-packages/customer-package.module.js').then(
      (module) => module.customerPackageRoutes,
    ),
  'package-transactions': (): ReturnType<RouteLoader> =>
    import('../modules/customer-packages/package-transaction.module.js').then(
      (module) => module.packageTransactionRoutes,
    ),
  'price-list': (): ReturnType<RouteLoader> =>
    import('../modules/price-list/price-list.module.js').then((module) => module.priceListRoutes),
  items: (): ReturnType<RouteLoader> =>
    import('../modules/items/items.module.js').then((module) => module.itemsRoutes),
  packages: (): ReturnType<RouteLoader> =>
    import('../modules/packages/package.module.js').then((module) => module.packageRoutes),
  'issue-reports': (): ReturnType<RouteLoader> =>
    import('../modules/issue-reports/issue-report.module.js').then((module) => module.issueReportRoutes),
  'order-items': (): ReturnType<RouteLoader> =>
    import('../modules/order-items/order-item.module.js').then((module) => module.orderItemRoutes),
  'order-reports': (): ReturnType<RouteLoader> =>
    import('../modules/order-reports/order-report.module.js').then((module) => module.orderReportRoutes),
  'order-snapshots': (): ReturnType<RouteLoader> =>
    import('../modules/order-snapshots/order-snapshot.module.js').then((module) => module.orderSnapshotRoutes),
  'work-orders': (): ReturnType<RouteLoader> =>
    import('../modules/work-orders/work-order.module.js').then((module) => module.workOrderRoutes),
  'job-tickets': (): ReturnType<RouteLoader> =>
    import('../modules/job-tickets/job-ticket.module.js').then((module) => module.jobTicketRoutes),
  'work-transactions': (): ReturnType<RouteLoader> =>
    import('../modules/work-transactions/work-transaction.module.js').then((module) => module.workTransactionRoutes),
  'order-images': (): ReturnType<RouteLoader> =>
    import('../modules/order-images/order-image.module.js').then((module) => module.orderImageRoutes),
  'laundry-photos': (): ReturnType<RouteLoader> =>
    import('../modules/laundry-photos/laundry-photo.module.js').then((module) => module.laundryPhotoRoutes),
  'after-photos': (): ReturnType<RouteLoader> =>
    import('../modules/after-photos/after-photo.module.js').then((module) => module.afterPhotoRoutes),
} satisfies Record<string, RouteLoader>

export async function resolveRoute(moduleName: string): ReturnType<RouteLoader> {
  const loader = (routeRegistry as Record<string, RouteLoader>)[moduleName]
  if (loader === undefined) {
    throw ApiError.notFound('Route not found')
  }
  return loader()
}
