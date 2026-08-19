import type { RouteLoader } from '../shared/http/gateway.types.js'

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
  'price-list': (): ReturnType<RouteLoader> =>
    import('../modules/price-list/price-list.module.js').then((module) => module.priceListRoutes),
} satisfies Record<string, RouteLoader>
