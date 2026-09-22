import type { RouteLocationRaw } from 'vue-router'

export const APPOINTMENT_CREATE_ROUTE_NAME = 'appointment-create'
export const ORDER_CREATE_ROUTE_NAME = 'order-create'
export const CUSTOMER_PACKAGE_CREATE_ROUTE_NAME = 'customer-package-create'
export const INVOICE_CREATE_ROUTE_NAME = 'invoice-create'
export const PRICE_LIST_ITEM_CREATE_ROUTE_NAME = 'price-list-item-create'

interface AppointmentCreateRouteContext {
  customerId: string
  orderId?: string
}

interface OptionalCustomerRouteContext {
  customerId?: string
}

interface InvoiceCreateRouteContext {
  customerId: string
  orderId: string
}

interface PriceListItemCreateRouteContext {
  orderId?: string
  category?: string | null
  subcategory?: string | null
}

export function appointmentCreateRoute(
  context: AppointmentCreateRouteContext,
): RouteLocationRaw {
  return {
    name: APPOINTMENT_CREATE_ROUTE_NAME,
    query: {
      customerId: context.customerId,
      ...(context.orderId ? { orderId: context.orderId } : {}),
    },
  }
}

export function orderCreateRoute(context: OptionalCustomerRouteContext = {}): RouteLocationRaw {
  return {
    name: ORDER_CREATE_ROUTE_NAME,
    query: context.customerId ? { customerId: context.customerId } : {},
  }
}

export function customerPackageCreateRoute(
  context: OptionalCustomerRouteContext = {},
): RouteLocationRaw {
  return {
    name: CUSTOMER_PACKAGE_CREATE_ROUTE_NAME,
    query: context.customerId ? { customerId: context.customerId } : {},
  }
}

export function invoiceCreateRoute(context: InvoiceCreateRouteContext): RouteLocationRaw {
  return {
    name: INVOICE_CREATE_ROUTE_NAME,
    query: {
      customerId: context.customerId,
      orderId: context.orderId,
    },
  }
}

export function priceListItemCreateRoute(context: PriceListItemCreateRouteContext = {}): RouteLocationRaw {
  return {
    name: PRICE_LIST_ITEM_CREATE_ROUTE_NAME,
    query: {
      ...(context.orderId ? { orderId: context.orderId } : {}),
      ...(context.category ? { category: context.category } : {}),
      ...(context.subcategory ? { subcategory: context.subcategory } : {}),
    },
  }
}
