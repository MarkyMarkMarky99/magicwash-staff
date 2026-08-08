import { z } from 'zod'
import type { SheetContract } from '../../shared/contracts/sheet-contract.js'

/** KEY ORDER = physical OrdersView sheet column order. */
export const ordersViewRowSchema = z.object({
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

export const ordersViewDbContract = {
  row: ordersViewRowSchema,
  // API field: orderId; the current code field map resolves it to orderId.
  primaryKey: 'orderId',
  sheetName: 'OrdersView',
  spreadsheetId: 'ORDERS_SPREADSHEET_ID',
  writes: { append: false, update: false, delete: false },
} satisfies SheetContract
