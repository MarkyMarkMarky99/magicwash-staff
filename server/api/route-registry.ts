import type { RouteLoader } from '../shared/http/gateway.types.js'
import { ApiError } from '../shared/http/api-error.js'

export const routeRegistry = {
  appointments: (): ReturnType<RouteLoader> =>
    import('../modules/appointments/appointment.module.js').then((module) => module.appointmentRoutes),
  customers: (): ReturnType<RouteLoader> =>
    import('../modules/customers/customer.module.js').then((module) => module.customerRoutes),
  orders: (): ReturnType<RouteLoader> =>
    import('../modules/orders/order.module.js').then((module) => module.orderRoutes),
  invoices: (): ReturnType<RouteLoader> =>
    import('../modules/invoices/invoice.module.js').then((module) => module.invoiceRoutes),
  'customer-packages': (): ReturnType<RouteLoader> =>
    import('../modules/customer-packages/customer-package-view.module.js').then(
      (module) => module.customerPackageRoutes,
    ),
  'package-transactions': (): ReturnType<RouteLoader> =>
    import('../modules/customer-packages/package-transaction.module.js').then(
      (module) => module.packageTransactionRoutes,
    ),
  'price-list': (): ReturnType<RouteLoader> =>
    import('../modules/price-list/price-list.module.js').then((module) => module.priceListRoutes),
  packages: (): ReturnType<RouteLoader> =>
    import('../modules/packages/package.module.js').then((module) => module.packageRoutes),
  'issue-reports': (): ReturnType<RouteLoader> =>
    import('../modules/issue-reports/issue-report.module.js').then((module) => module.issueReportRoutes),
  'order-items': (): ReturnType<RouteLoader> =>
    import('../modules/order-items/order-item.module.js').then((module) => module.orderItemRoutes),
  'work-orders': (): ReturnType<RouteLoader> =>
    import('../modules/work-orders/work-order.module.js').then((module) => module.workOrderRoutes),
  'order-images': (): ReturnType<RouteLoader> =>
    import('../modules/order-images/order-image.module.js').then((module) => module.orderImageRoutes),
} satisfies Record<string, RouteLoader>

export async function resolveRoute(moduleName: string): ReturnType<RouteLoader> {
  const loader = (routeRegistry as Record<string, RouteLoader>)[moduleName]
  if (loader === undefined) {
    throw ApiError.notFound('Route not found')
  }
  return loader()
}
