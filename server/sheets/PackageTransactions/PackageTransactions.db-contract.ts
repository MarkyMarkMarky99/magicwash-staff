import { z } from 'zod'
import type { SheetContract } from '../../shared/contracts/sheet-contract.js'

const packageTransactionTypeDbSchema = z.enum(['PURCHASE', 'USAGE', 'REFUND', 'ADJUSTMENT', 'EXPIRE', 'VOID', 'TRANSFER'])

/** KEY ORDER = physical PackageTransactions sheet column order. */
export const packageTransactionsRowSchema = z.object({
  id: z.string(),
  customer_package_id: z.string(),
  customer_id: z.string(),
  type: packageTransactionTypeDbSchema,
  reference_source: z.string().nullable(),
  reference_id: z.string().nullable(),
  credit_change: z.number(),
  notes: z.string().nullable(),
  created_at: z.string(),
  created_by: z.string(),
}).strict()

export const packageTransactionsDbContract = {
  row: packageTransactionsRowSchema,
  primaryKey: 'id',
  sheetName: 'PackageTransactions',
  spreadsheetId: 'LAUNDRY_PACKAGES_SPREADSHEET_ID',
  audit: { onAppend: ['created_at'] },
  writes: { append: true, update: false, delete: false },
} satisfies SheetContract
