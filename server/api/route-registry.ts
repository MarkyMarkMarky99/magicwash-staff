import type { RouteLoader } from '../shared/http/gateway.types.js'

export const routeRegistry = {
  appointments: (): ReturnType<RouteLoader> =>
    import('../modules/appointments/appointment.module.js').then((module) => module.appointmentRoutes),
  customers: (): ReturnType<RouteLoader> =>
    import('../modules/customers/customer.module.js').then((module) => module.customerRoutes),
  orders: (): ReturnType<RouteLoader> =>
    import('../modules/orders/order.module.js').then((module) => module.orderRoutes),
} satisfies Record<string, RouteLoader>
