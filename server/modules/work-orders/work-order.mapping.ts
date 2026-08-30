import type { z } from 'zod'
import { orderFormRowSchema } from '../../sheets/OrderForm/OrderForm.db-contract.js'
import { Mapper, type ApiRowFromFieldMap } from '../../shared/repositories/base.repository.js'

export type OrderFormDbRow = z.infer<typeof orderFormRowSchema>

export const orderFormFieldMap = {
  id: 'orderId',
  order_number: 'orderNumber',
  customer_id: 'customerId',
  received_date: 'receivedDate',
  due_date: 'dueDate',
  service_type: 'serviceType',
  status: 'status',
  quantity: 'quantity',
  hangers: 'hangers',
  bags: 'bags',
  hangers_image: 'hangersImage',
  bags_image: 'bagsImage',
  form_image: 'formImage',
  note: 'note',
  timestamp: 'createdAt',
  created_by: 'createdBy',
  updated_at: 'updatedAt',
  updated_by: 'updatedBy',
  invoice_id: 'invoiceNumber',
  order_name: 'orderName',
  order_description: 'orderDescription',
} as const satisfies Record<keyof OrderFormDbRow & string, string>

export type OrderFormApiRow = ApiRowFromFieldMap<OrderFormDbRow, typeof orderFormFieldMap>

export const orderFormMapper = new Mapper(orderFormFieldMap)
