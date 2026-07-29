import type { z } from 'zod'
import { customerDetailResponseSchema } from '@contracts/customers/customer-api.schema'
import {
  orderListQuerySchema,
  orderListResponseSchema,
} from '@contracts/orders/order-api.schema'
import { apiGet, apiGetList } from '@/shared/api/api-client'

export type InvoiceCreateCustomer = z.infer<typeof customerDetailResponseSchema>
export type InvoiceCreateOrder = z.infer<typeof orderListResponseSchema>

export interface InvoiceCreateContext {
  customer: InvoiceCreateCustomer
  order: InvoiceCreateOrder
}

export async function loadInvoiceCreateContext(
  customerId: string,
  orderId: string,
): Promise<InvoiceCreateContext> {
  const [customer, orderResult] = await Promise.all([
    apiGet<InvoiceCreateCustomer>(`/api/customers/${encodeURIComponent(customerId)}`),
    apiGetList<InvoiceCreateOrder>('/api/orders', {
      query: { customerId },
      querySchema: orderListQuerySchema,
    }),
  ])

  const order = orderResult.items.find((item) => item.orderId.trim() === orderId)
  if (!order) {
    throw new Error(`Order ${orderId} was not found for customer ${customerId}`)
  }

  return { customer, order }
}
