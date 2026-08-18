import { z } from 'zod'
import type { SheetContract } from '../../shared/contracts/sheet-contract.js'

/** KEY ORDER = physical PriceList sheet column order. */
export const priceListRowSchema = z.object({
  id: z.string().regex(/^[a-z0-9]{8}$/),
  item_code: z.string().regex(/^ITM-[0-9]{4,}$/),
  category: z.string().min(1),
  subcategory: z.string().min(1),
  itemtype: z.string().min(1),
  variant: z.string().min(1).nullable(),
  display_name_th: z.string().min(1),
  wash_dry_iron_price: z.number().nullable(),
  iron_only_price: z.number().nullable(),
  dry_clean_price: z.number().nullable(),
  credit_eligible: z.boolean(),
  effective_from: z.string(),
  effective_to: z.string().nullable(),
  active: z.boolean(),
})

export const priceListDbContract = {
  row: priceListRowSchema,
  primaryKey: 'id',
  sheetName: 'PriceList',
  spreadsheetId: 'PRICE_LIST_SPREADSHEET_ID',
  writes: { append: false, update: false, delete: false },
} satisfies SheetContract
