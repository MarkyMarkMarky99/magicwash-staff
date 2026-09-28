import { z } from 'zod'
import type { SheetContract } from '../../shared/contracts/sheet-contract.js'

/** KEY ORDER = physical CustomerIDMapping sheet column order. */
export const customerIdMappingRowSchema = z.object({
  CustomerLabel: z.string(),
  CustomerID: z.string().nullable(),
}).strict()

export const customerIdMappingDbContract = {
  row: customerIdMappingRowSchema,
  primaryKey: 'CustomerLabel',
  sheetName: 'CustomerIDMapping',
  spreadsheetId: 'CUSTOMERS_SPREADSHEET_ID',
  writes: { append: false, update: false, delete: false },
} satisfies SheetContract
