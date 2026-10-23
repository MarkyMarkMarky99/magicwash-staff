import { z } from 'zod'
import type { SheetContract } from '../../shared/contracts/sheet-contract.js'

export const orderGarmentsRowSchema = z.object({
  id: z.string(),
  order_id: z.string(),
  laundry_item_id: z.string().regex(/^[0-9A-Za-z]{8}$/),
  orderitem_id: z.string().nullable(),
  notes: z.string().nullable(),
  status: z.enum(['RECEIVED', 'WASHING', 'DRY_CLEANING', 'IRONING', 'PACKING', 'READY', 'DELIVERED']),
  created_at: z.string(),
  created_by: z.string(),
  updated_at: z.string().nullable(),
  updated_by: z.string().nullable(),
  deleted_at: z.string().nullable(),
  deleted_by: z.string().nullable(),
}).strict()

export const orderGarmentsDbContract = {
  row: orderGarmentsRowSchema,
  primaryKey: 'id',
  sheetName: 'OrderGarments',
  spreadsheetId: 'LAUNDRY_ITEMS_SPREADSHEET_ID',
  audit: { onAppend: ['created_at'], onUpdate: ['updated_at'] },
  writes: { append: true, update: true, delete: false },
} satisfies SheetContract
