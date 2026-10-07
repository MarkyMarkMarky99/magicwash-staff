import { z } from 'zod'
import type { SheetContract } from '../../shared/contracts/sheet-contract.js'

/** KEY ORDER = physical BagItems sheet column order. */
export const bagItemsRowSchema = z.object({
  id: z.string(),
  bag_id: z.string(),
  order_id: z.string(),
  laundry_item_id: z.string(),
  created_at: z.string(),
  created_by: z.string(),
}).strict()

export const bagItemsDbContract = {
  row: bagItemsRowSchema,
  primaryKey: 'id',
  sheetName: 'BagItems',
  spreadsheetId: 'ORDERS_SPREADSHEET_ID',
  audit: { onAppend: ['created_at'] },
  writes: { append: true, update: false, delete: false },
} satisfies SheetContract
