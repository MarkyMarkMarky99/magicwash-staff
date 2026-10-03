import { z } from 'zod'
import type { SheetContract } from '../../shared/contracts/sheet-contract.js'

const workTransactionTypeDbSchema = z.enum(['EARN', 'ADJUSTMENT', 'VOID'])

/** KEY ORDER = physical WorkTransactions sheet column order. */
export const workTransactionsRowSchema = z.object({
  id: z.string(),
  job_ticket_id: z.string(),
  type: workTransactionTypeDbSchema,
  minutes: z.number(),
  notes: z.string().nullable(),
  created_at: z.string(),
  created_by: z.string(),
}).strict()

export const workTransactionsDbContract = {
  row: workTransactionsRowSchema,
  primaryKey: 'id',
  sheetName: 'WorkTransactions',
  spreadsheetId: 'WORK_SPREADSHEET_ID',
  audit: { onAppend: ['created_at'] },
  writes: { append: true, update: false, delete: false },
} satisfies SheetContract
