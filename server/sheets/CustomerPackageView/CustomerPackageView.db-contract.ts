import { z } from 'zod'
import type { SheetContract } from '../../shared/contracts/sheet-contract.js'

const customerPackageStatusSchema = z.enum(['INACTIVE', 'ACTIVE', 'EXPIRED', 'CANCELLED'])
/**
 * KEY ORDER = physical CustomerPackageView sheet column order. The source
 * sheet stores transactionsJson as JSON text; GViz decodes it after reading.
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
  // Stored as plain text: a JSON string in the cell, hence the "Json" suffix.
  // Parsing happens above this layer.
  transactionsJson: z.string(),
})

export const customerPackageViewDbContract = {
  row: customerPackageViewRowSchema,
  primaryKey: 'customerPackageId',
  sheetName: 'CustomerPackageView',
  spreadsheetId: 'PORTAL_SPREADSHEET_ID',
  writes: { append: false, update: false, delete: false },
} satisfies SheetContract
