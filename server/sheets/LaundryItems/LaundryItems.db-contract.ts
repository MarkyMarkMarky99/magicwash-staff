import { z } from 'zod'
import type { SheetContract } from '../../shared/contracts/sheet-contract.js'

/** KEY ORDER = physical LaundryItems sheet column order. */
export const laundryItemsRowSchema = z.object({
  id: z.string().regex(/^[0-9A-Za-z]{8}$/),
  customer_id: z.string(),
  item_id: z.string().nullable(),
  wash_program: z.string().nullable(),
  notes: z.string().nullable(),
  created_at: z.string(),
  created_by: z.string(),
  updated_at: z.string().nullable(),
  updated_by: z.string().nullable(),
  deleted_at: z.string().nullable(),
  deleted_by: z.string().nullable(),
  image_url: z.string().nullable(),
}).strict()

export const laundryItemsDbContract = {
  row: laundryItemsRowSchema,
  primaryKey: 'id',
  sheetName: 'LaundryItems',
  spreadsheetId: 'LAUNDRY_ITEMS_SPREADSHEET_ID',
  audit: { onAppend: ['created_at'], onUpdate: ['updated_at'] },
  writes: { append: true, update: true, delete: false },
} satisfies SheetContract
