import { z } from 'zod'
import type { SheetContract } from '../../shared/contracts/sheet-contract.js'

/** KEY ORDER = physical OrdersView sheet column order. */
export const ordersViewRowSchema = z.object({
  order_id: z.string(),
  customer_id: z.string(),
  order_number: z.string().nullable(),
  invoice_number: z.string().nullable(),
  received_date: z.string().nullable(),
  due_date: z.string().nullable(),
  service_type: z.string().nullable(),
  status: z.string().nullable(),
  quantity: z.string().nullable(),
  note: z.string().nullable(),
  items_json: z.string().nullable(),
  synced_at: z.string(),
  created_at: z.string().nullable(),
})

export const ordersViewDbContract = {
  row: ordersViewRowSchema,
  // Database column: order_id, as declared by the schema registry.
  primaryKey: 'order_id',
  sheetName: 'OrdersView',
  spreadsheetId: 'ORDERS_SPREADSHEET_ID',
  writes: { append: false, update: false, delete: false },
} satisfies SheetContract
