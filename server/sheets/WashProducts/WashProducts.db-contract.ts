import { z } from 'zod'
import type { SheetContract } from '../../shared/contracts/sheet-contract.js'

export const washProductsRowSchema = z.object({
  id: z.string(),
  type: z.enum(['DETERGENT', 'SOFTENER', 'BLEACH']),
  name: z.string(),
  status: z.enum(['ACTIVE', 'INACTIVE']),
  sort_order: z.number().nullable(),
  note: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string().nullable(),
}).strict()
export const washProductsDbContract = {
  row: washProductsRowSchema,
  primaryKey: 'id',
  sheetName: 'WashProducts',
  spreadsheetId: 'JOB_TICKETS_SPREADSHEET_ID',
  writes: { append: false, update: false, delete: false },
} satisfies SheetContract
