import { z } from 'zod'
import type { SheetContract } from '../../shared/contracts/sheet-contract.js'

const customerPackageStatusSchema = z.enum(['INACTIVE', 'ACTIVE', 'EXPIRED', 'CANCELLED'])
const packageTransactionTypeSchema = z.enum([
  'PURCHASE',
  'USAGE',
  'REFUND',
  'ADJUSTMENT',
  'EXPIRE',
  'VOID',
  'TRANSFER',
])

const packageTransactionSchema = z.object({
  id: z.string(),
  type: packageTransactionTypeSchema,
  creditChange: z.number(),
  remainingCredit: z.number(),
  referenceSource: z.string().nullable(),
  referenceId: z.string().nullable(),
  notes: z.string().nullable(),
  createdAt: z.string(),
})

/**
 * KEY ORDER = physical CustomerPackageView sheet column order after GViz
 * JSON-cell decoding. The source sheet stores transactions as JSON text.
 */
export const customerPackageViewRowSchema = z.object({
  customerPackageId: z.string(),
  customerId: z.string(),
  customerName: z.string(),
  customerPhone: z.string().nullable(),
  customerAddress: z.string().nullable(),
  packageCode: z.string(),
  packageName: z.string(),
  packageEligibleService: z.string(),
  startDate: z.string().nullable(),
  expiryDate: z.string().nullable(),
  status: customerPackageStatusSchema,
  serviceDay: z.string().nullable(),
  timeSlot: z.string().nullable(),
  invoiceId: z.string().nullable(),
  notes: z.string().nullable(),
  remainingCredit: z.number(),
  usedCredit: z.number(),
  totalCredit: z.number(),
  transactions: z.array(packageTransactionSchema),
})

export const customerPackageViewDbContract = {
  row: customerPackageViewRowSchema,
  // API field: customerPackageId; the current view contract uses the same name.
  primaryKey: 'customerPackageId',
  sheetName: 'CustomerPackageView',
  spreadsheetId: 'ORDERS_SPREADSHEET_ID',
  writes: { append: false, update: false, delete: false },
  decodeJsonCells: true,
} satisfies SheetContract
