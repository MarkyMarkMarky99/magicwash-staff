import { z } from 'zod'
import type { SheetContract } from '../../shared/contracts/sheet-contract.js'

/** KEY ORDER = physical Packages sheet column order. */
export const packagesRowSchema = z.object({
  package_code: z.string(),
  name: z.string(),
  eligible_service: z.string(),
  included_credit: z.number(),
  price: z.number(),
  notes: z.string().nullable(),
  created_at: z.string(),
  created_by: z.string(),
  updated_at: z.string(),
  updated_by: z.string(),
  deleted_at: z.string().nullable(),
  deleted_by: z.string().nullable(),
}).strict()

export const packagesDbContract = {
  row: packagesRowSchema,
  primaryKey: 'package_code',
  sheetName: 'Packages',
  spreadsheetId: 'LAUNDRY_PACKAGES_SPREADSHEET_ID',
  writes: { append: false, update: false, delete: false },
} satisfies SheetContract
