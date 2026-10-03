import { z } from 'zod'
import type { SheetContract } from '../../shared/contracts/sheet-contract.js'
import { jobTicketDepartmentSchema } from '../JobTickets/JobTickets.db-contract.js'

const workRateLevelDbSchema = z.enum(['EASY', 'MEDIUM', 'HARD'])

/** KEY ORDER = physical WorkRates sheet column order. */
export const workRatesRowSchema = z.object({
  id: z.string(),
  department: jobTicketDepartmentSchema,
  level: workRateLevelDbSchema,
  name_th: z.string(),
  minutes: z.number(),
  active: z.boolean(),
  notes: z.string().nullable(),
  created_at: z.string(),
  created_by: z.string(),
  updated_at: z.string().nullable(),
  updated_by: z.string().nullable(),
}).strict()

export const workRatesDbContract = {
  row: workRatesRowSchema,
  primaryKey: 'id',
  sheetName: 'WorkRates',
  spreadsheetId: 'WORK_SPREADSHEET_ID',
  writes: { append: false, update: false, delete: false },
} satisfies SheetContract
