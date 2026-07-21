import type { RouteLoader } from '../shared/http/gateway.types.js'

export const routeRegistry = {
  appointments: (): ReturnType<RouteLoader> =>
    import('../modules/appointments/appointment.routes.js').then((module) => module.appointmentRoutes),
  customers: (): ReturnType<RouteLoader> =>
    import('../modules/customers/customer.routes.js').then((module) => module.customerRoutes),
  orders: (): ReturnType<RouteLoader> =>
    import('../modules/orders/order.routes.js').then((module) => module.orderRoutes),
} satisfies Record<string, RouteLoader>
