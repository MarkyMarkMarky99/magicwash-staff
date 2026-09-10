import type { z } from 'zod'
import { customerDetailResponseSchema } from '@contracts/customers/customer-api.schema'
import { workOrderDetailResponseSchema } from '@contracts/work-orders/work-order-api.schema'
import { apiGet } from '@/shared/api/api-client'

export type InvoiceCreateCustomer = z.infer<typeof customerDetailResponseSchema>
export type InvoiceCreateOrder = z.infer<typeof workOrderDetailResponseSchema>

export interface InvoiceCreateContext {
  customer: InvoiceCreateCustomer
  order: InvoiceCreateOrder
}

export async function loadInvoiceCreateContext(
  customerId: string,
  orderId: string,
): Promise<InvoiceCreateContext> {
  const [customer, order] = await Promise.all([
    apiGet<InvoiceCreateCustomer>(`/api/customers/${encodeURIComponent(customerId)}`),
    apiGet<InvoiceCreateOrder>(`/api/work-orders/${encodeURIComponent(orderId)}`),
  ])

  if (order.customerId.trim() !== customerId) {
    throw new Error(`Order ${orderId} was not found for customer ${customerId}`)
  }

  return { customer, order }
}
