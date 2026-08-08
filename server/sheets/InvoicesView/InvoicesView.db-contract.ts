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

const invoiceViewCustomerSchema = z.object({
  customerCode: z.string().nullable(),
  customerName: z.string().nullable(),
  phone: z.string().nullable(),
  address: z.string().nullable(),
})

const invoiceViewAdjustmentSchema = z.object({
  label: z.string().nullable(),
  calculation: z.string().nullable(),
  value: z.number().nullable(),
  refSource: z.string().nullable(),
  refCode: z.string().nullable(),
})

const invoiceViewItemSchema = z.object({
  description: z.string().nullable(),
  unit: z.string().nullable(),
  quantity: z.number().nullable(),
  unitPrice: z.number().nullable(),
  subtotal: z.number().nullable(),
  adjustments: z.array(invoiceViewAdjustmentSchema),
  netTotal: z.number().nullable(),
})

const invoiceViewPaymentSchema = z.object({
  paymentId: z.string().nullable(),
  amount: z.number().nullable(),
  method: z.enum(['CASH', 'BANK_TRANSFER', 'CREDIT_CARD', 'QR_PROMPTPAY', 'GIFT_VOUCHER', 'OTHER']).nullable(),
  status: z.enum(['PENDING', 'VERIFIED', 'FAILED', 'CANCELLED']),
  paidAt: z.string().nullable(),
  reference: z.string().nullable(),
  proofUrl: z.string().nullable(),
  notes: z.string().nullable(),
})

/**
 * KEY ORDER = physical InvoicesView sheet column order after GViz JSON-cell
 * decoding. The source sheet stores the four nested values as JSON text.
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
  customer: invoiceViewCustomerSchema,
  items: z.array(invoiceViewItemSchema),
  adjustments: z.array(invoiceViewAdjustmentSchema),
  payments: z.array(invoiceViewPaymentSchema),
  subtotal: z.number(),
  adjustmentTotal: z.number(),
  grandTotal: z.number(),
  paidAmount: z.number(),
  balanceDue: z.number(),
})

export const invoicesViewDbContract = {
  row: invoicesViewRowSchema,
  // API field: invoiceNumber; the current view contract uses the same name.
  primaryKey: 'invoiceNumber',
  sheetName: 'InvoicesView',
  spreadsheetId: 'ORDERS_SPREADSHEET_ID',
  writes: { append: false, update: false, delete: false },
  decodeJsonCells: true,
} satisfies SheetContract
