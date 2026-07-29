import { z } from 'zod'
import { orderApiContract } from '../../../contracts/orders/order-api.schema.js'
import type { ModuleContract, ModuleDbContract } from '../../shared/contracts/module-db-contract.js'

/**
 * DB contract for the read-only OrdersView materialized view.
 * KEY ORDER = physical sheet column order.
 */
export const orderRowSchema = z.object({
  orderId: z.string(),
  customerId: z.string(),
  orderNumber: z.string().nullable(),
  invoiceNumber: z.string().nullable(),
  receivedDate: z.string().nullable(),
  dueDate: z.string().nullable(),
  serviceType: z.string().nullable(),
  status: z.string().nullable(),
  quantity: z.string().nullable(),
  note: z.string().nullable(),
  itemsJson: z.string().nullable(),
  syncedAt: z.string(),
  createdAt: z.string().nullable(),
})

/** OrdersView columns are already camelCase; keep the identity map explicit. */
export const orderFieldMap = {
  orderId: 'orderId',
  customerId: 'customerId',
  orderNumber: 'orderNumber',
  invoiceNumber: 'invoiceNumber',
  receivedDate: 'receivedDate',
  dueDate: 'dueDate',
  serviceType: 'serviceType',
  status: 'status',
  quantity: 'quantity',
  note: 'note',
  itemsJson: 'itemsJson',
  syncedAt: 'syncedAt',
  createdAt: 'createdAt',
} as const satisfies Record<keyof z.infer<typeof orderRowSchema> & string, string>

export type OrderRow = z.infer<typeof orderRowSchema>

export const orderDbContract = {
  row: orderRowSchema,
  fieldMap: orderFieldMap,
  primaryKey: 'orderId',
  request: {}, // no create/update/delete — explicit empty object, not omitted
  response: { read: orderRowSchema.partial() },
} satisfies ModuleDbContract

export const orderContract = {
  api: orderApiContract,
  db: orderDbContract,
} satisfies ModuleContract
