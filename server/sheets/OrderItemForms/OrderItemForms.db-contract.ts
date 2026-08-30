import { z } from 'zod'
import type { SheetContract } from '../../shared/contracts/sheet-contract.js'

/** KEY ORDER = physical OrderItemForms sheet column order. */
export const orderItemFormsRowSchema = z.object({
  id: z.string(),
  order_id: z.string().nullable(),
  item_id: z.string().nullable(),
  description: z.string().nullable(),
  quantity: z.number().nullable(),
  price: z.number().nullable(),
  credits_used: z.number().nullable(),
  timestamp: z.string().nullable(),
  category: z.string().nullable(),
  service_type: z.string().nullable(),
  special_instructions: z.string().nullable(),
  created_by: z.string().nullable(),
  updated_at: z.string().nullable(),
  updated_by: z.string().nullable(),
  invoice_item_id: z.string().nullable(),
})

export const orderItemFormsDbContract = {
  row: orderItemFormsRowSchema,
  primaryKey: 'id',
  sheetName: 'OrderItemForms',
  spreadsheetId: 'ORDERS_SPREADSHEET_ID',
  audit: {
    onAppend: ['timestamp'],
    onUpdate: [],
  },
  writes: { append: true, update: false, delete: false },
} satisfies SheetContract
