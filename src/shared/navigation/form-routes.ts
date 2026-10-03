import type { RouteLocationRaw } from 'vue-router'

export const APPOINTMENT_CREATE_ROUTE_NAME = 'appointment-create'
export const ORDER_CREATE_ROUTE_NAME = 'order-create'
export const ORDER_EDIT_ROUTE_NAME = 'order-edit'
export const CUSTOMER_PACKAGE_CREATE_ROUTE_NAME = 'customer-package-create'
export const INVOICE_CREATE_ROUTE_NAME = 'invoice-create'
export const PRICE_LIST_ITEM_CREATE_ROUTE_NAME = 'price-list-item-create'
export const INVOICE_PAYMENT_CREATE_ROUTE_NAME = 'invoice-payment-create'
export const INVOICE_PAYMENT_REVIEW_ROUTE_NAME = 'invoice-payment-review'
export const STAFF_REGISTER_ROUTE_NAME = 'staff-register'
export const STAFF_EDIT_ROUTE_NAME = 'staff-edit'

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

export function orderEditRoute(orderId: string): RouteLocationRaw {
  return { name: ORDER_EDIT_ROUTE_NAME, params: { orderId } }
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

export function invoicePaymentCreateRoute(invoiceNumber: string): RouteLocationRaw {
  return {
    name: INVOICE_PAYMENT_CREATE_ROUTE_NAME,
    query: { invoiceNumber },
  }
}

export function invoicePaymentReviewRoute(invoiceNumber: string, paymentId: string): RouteLocationRaw {
  return {
    name: INVOICE_PAYMENT_REVIEW_ROUTE_NAME,
    query: { invoiceNumber, paymentId },
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

export function staffRegisterRoute(): RouteLocationRaw {
  return { name: STAFF_REGISTER_ROUTE_NAME }
}

export function staffEditRoute(staffId: string): RouteLocationRaw {
  return { name: STAFF_EDIT_ROUTE_NAME, params: { staffId } }
}
