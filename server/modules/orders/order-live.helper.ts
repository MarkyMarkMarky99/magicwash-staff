import { z } from 'zod'
import { ReadQueryDTO } from '../../shared/dtos/read-query.dto.js'
import { getOrderFormRepository } from '../../sheets/OrderForm/OrderForm.repository.js'
import { orderFormRowSchema } from '../../sheets/OrderForm/OrderForm.db-contract.js'
import { getOrderItemFormsRepository } from '../../sheets/OrderItemForms/OrderItemForms.repository.js'
import { orderItemFormsRowSchema } from '../../sheets/OrderItemForms/OrderItemForms.db-contract.js'

type OrderFormRow = Partial<z.infer<typeof orderFormRowSchema>>
type OrderItemFormsRow = Partial<z.infer<typeof orderItemFormsRowSchema>>

export interface LiveOrderItem {
  id: string
  itemId: string
  description: string
  quantity: number | ''
  price: number | ''
  creditsUsed: number | ''
  category: string
  serviceType: string
  specialInstructions: string
}

export interface LiveOrderView {
  orderId: string | undefined
  customerId: string | undefined
  orderNumber: string | null | undefined
  invoiceNumber: string | null | undefined
  receivedDate: string | undefined
  dueDate: string | undefined
  serviceType: string | undefined
  status: string | undefined
  quantity: number | null | undefined
  note: string | null | undefined
  createdAt: string | undefined
  items: LiveOrderItem[]
}

function hasItemId(row: OrderItemFormsRow): row is OrderItemFormsRow & { id: string } {
  return typeof row.id === 'string' && row.id.trim() !== ''
}

function toLiveOrderItem(row: OrderItemFormsRow & { id: string }): LiveOrderItem {
  return {
    id: row.id,
    itemId: row.item_id ?? '',
    description: row.description ?? '',
    quantity: row.quantity ?? '',
    price: row.price ?? '',
    creditsUsed: row.credits_used ?? '',
    category: row.category ?? '',
    serviceType: row.service_type ?? '',
    specialInstructions: row.special_instructions ?? '',
  }
}

function assembleLiveOrder(order: OrderFormRow, itemRows: OrderItemFormsRow[]): LiveOrderView {
  return {
    orderId: order.id,
    customerId: order.customer_id,
    orderNumber: order.order_number,
    invoiceNumber: order.invoice_id,
    receivedDate: order.received_date,
    dueDate: order.due_date,
    serviceType: order.service_type,
    status: order.status,
    quantity: order.quantity,
    note: order.note,
    createdAt: order.received_date,
    items: itemRows.filter(hasItemId).map(toLiveOrderItem),
  }
}

/**
 * Builds the live order read model from its two source sheets.
 * The caller must validate orderId before calling this helper.
 */
export async function getLiveOrderById(orderId: string): Promise<LiveOrderView | null> {
  const orders = await getOrderFormRepository().read(
    ReadQueryDTO.fromId<OrderFormRow>(orderId),
  )
  const order = orders[0]
  if (order === undefined) {
    return null
  }

  const itemRows = await getOrderItemFormsRepository().read(
    new ReadQueryDTO<OrderItemFormsRow>({ where: { order_id: orderId } }),
  )
  return assembleLiveOrder(order, itemRows)
}
