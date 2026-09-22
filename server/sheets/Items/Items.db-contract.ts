import { z } from 'zod'
import type { SheetContract } from '../../shared/contracts/sheet-contract.js'

/** KEY ORDER = physical Items sheet column order. */
export const itemsRowSchema = z.object({
  id: z.string().regex(/^[a-z0-9]{8}$/),
  item_code: z.string().regex(/^ITM-[0-9]{4,}$/),
  category: z.string().min(1),
  subcategory: z.string().min(1),
  itemtype: z.string().min(1),
  variant: z.string().min(1).nullable(),
  display_name_th: z.string().min(1),
  display_name_en: z.string().min(1).nullable(),
  active: z.boolean(),
  image_url: z.string().min(1).nullable(),
})

export const itemsDbContract = {
  row: itemsRowSchema,
  primaryKey: 'id',
  sheetName: 'Items',
  spreadsheetId: 'PRICE_LIST_SPREADSHEET_ID',
  writes: { append: true, update: true, delete: false },
} satisfies SheetContract
