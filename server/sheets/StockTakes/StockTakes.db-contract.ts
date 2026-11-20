import { z } from 'zod'
import type { SheetContract } from '../../shared/contracts/sheet-contract.js'

export const stockTakesRowSchema = z.object({
  id: z.string(),
  status: z.enum(['OPEN', 'CLOSED', 'APPLIED', 'CANCELLED']),
  opened_at: z.string(),
  opened_by: z.string(),
  closed_at: z.string().nullable(),
  closed_by: z.string().nullable(),
  applied_at: z.string().nullable(),
  applied_by: z.string().nullable(),
  notes: z.string().nullable(),
}).strict()

export const stockTakesDbContract = {
  row: stockTakesRowSchema,
  primaryKey: 'id',
  sheetName: 'StockTakes',
  spreadsheetId: 'JOB_TICKETS_SPREADSHEET_ID',
  audit: { onAppend: ['opened_at'] },
  writes: { append: true, update: true, delete: false },
} satisfies SheetContract
