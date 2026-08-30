import { z } from 'zod'
import type { SheetContract } from '../../shared/contracts/sheet-contract.js'

/** KEY ORDER = physical OrderImages sheet column order. */
export const orderImagesRowSchema = z.object({
  id: z.string(),
  customer_id: z.string().nullable(),
  delivery_id: z.string().nullable(),
  order_id: z.string(),
  image_type: z.string().nullable(),
  image_path: z.string().nullable(),
  notes: z.string().nullable(),
  quantity: z.number().nullable(),
  created_at: z.string().nullable(),
  created_by: z.string().nullable(),
})

export const orderImagesDbContract = {
  row: orderImagesRowSchema,
  primaryKey: 'id',
  sheetName: 'OrderImages',
  spreadsheetId: 'ORDERS_SPREADSHEET_ID',
  audit: {
    onAppend: ['created_at'],
    onUpdate: [],
  },
  writes: { append: true, update: false, delete: false },
} satisfies SheetContract
