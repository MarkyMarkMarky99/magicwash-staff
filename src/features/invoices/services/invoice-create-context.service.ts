import { getCustomerById, type CustomerDetailDto } from '@/data/customers/customer.service'
import { getWorkOrder, type WorkOrderDetailDto } from '@/data/work-orders/work-order.service'

export type InvoiceCreateCustomer = CustomerDetailDto
export type InvoiceCreateOrder = WorkOrderDetailDto

export interface InvoiceCreateContext {
  customer: InvoiceCreateCustomer
  order: InvoiceCreateOrder
}

export async function loadInvoiceCreateContext(
  customerId: string,
  orderId: string,
): Promise<InvoiceCreateContext> {
  const [customer, order] = await Promise.all([
    getCustomerById(customerId),
    getWorkOrder(orderId),
  ])

  if (customer.customerId.trim() !== customerId || order.customerId.trim() !== customer.customerId.trim()) {
    throw new Error(`Order ${orderId} was not found for customer ${customerId}`)
  }

  return { customer, order }
}
