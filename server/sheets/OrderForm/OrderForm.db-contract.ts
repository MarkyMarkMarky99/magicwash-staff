import { z } from 'zod'
import type { SheetContract } from '../../shared/contracts/sheet-contract.js'

/** KEY ORDER = physical OrderForm sheet column order. */
export const orderFormRowSchema = z.object({
  id: z.string().min(1),
  order_number: z.string().nullable(),
  customer_id: z.string().min(1),
  received_date: z.string(),
  due_date: z.string(),
  service_type: z.enum(['WSIR', 'IRON']),
  status: z.enum(['PENDING', 'RECEIVED', 'SUBMITTED', 'APPROVED', 'COMPLETED', 'CANCELLED']),
  quantity: z.number().nullable(),
  hangers: z.number().nullable(),
  bags: z.number().nullable(),
  hangers_image: z.string().nullable(),
  bags_image: z.string().nullable(),
  form_image: z.string().nullable(),
  note: z.string().nullable(),
  timestamp: z.string().nullable(),
  created_by: z.string().nullable(),
  updated_at: z.string().nullable(),
  updated_by: z.string().nullable(),
  invoice_id: z.string().nullable(),
  order_name: z.string().nullable(),
  order_description: z.string().nullable(),
})

export const orderFormDbContract = {
  row: orderFormRowSchema,
  // API field: id.
  primaryKey: 'id',
  sheetName: 'OrderForm',
  // This tab's registry workbook may differ from the ORDERS_SPREADSHEET_ID value.
  spreadsheetId: 'ORDERS_SPREADSHEET_ID',
  // updated_at is intentionally a real Sheets datetime, not plain text.
  // This valueInput declaration records that intent and guards against a conflict.
  valueInput: { updated_at: 'USER_ENTERED' },
  writes: { append: false, update: true, delete: false },
} satisfies SheetContract
