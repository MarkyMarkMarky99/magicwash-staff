import { z } from 'zod'
import type { SheetContract } from '../../shared/contracts/sheet-contract.js'

const invoiceViewStatusSchema = z.enum([
  'DRAFT',
  'UNPAID',
  'OVERDUE',
  'PARTIALLY_PAID',
  'PAID',
  'CANCELLED',
  'VOID',
])
const invoiceViewBillingTypeSchema = z.enum(['ORDER', 'CYCLE'])

/**
 * KEY ORDER = physical InvoicesView sheet column order.
 *
 * This is a portal view sheet: Apps Script materializes it and flattens nested
 * data into JSON text cells. That is a view-building device, not a real storage
 * structure, so the `*Json` columns are typed as the plain text they hold.
 */
export const invoicesViewRowSchema = z.object({
  invoiceNumber: z.string(),
  status: invoiceViewStatusSchema,
  billingType: invoiceViewBillingTypeSchema,
  billingPeriodStart: z.string().nullable(),
  billingPeriodEnd: z.string().nullable(),
  issuedDate: z.string(),
  dueDate: z.string(),
  customerId: z.string(),
  // Stored as plain text: these cells hold JSON strings, which is why the
  // column names end in "Json". Parsing them into structures happens above
  // this layer — the database contract describes what the sheet stores.
  customerJson: z.string(),
  itemsJson: z.string(),
  adjustmentsJson: z.string(),
  paymentsJson: z.string(),
  subtotal: z.number(),
  adjustmentTotal: z.number(),
  grandTotal: z.number(),
  paidAmount: z.number(),
  balanceDue: z.number(),
})

export const invoicesViewDbContract = {
  row: invoicesViewRowSchema,
  // Database column: invoiceNumber, as declared by the schema registry.
  primaryKey: 'invoiceNumber',
  sheetName: 'InvoicesView',
  spreadsheetId: 'PORTAL_SPREADSHEET_ID',
  writes: { append: false, update: false, delete: false },
} satisfies SheetContract
