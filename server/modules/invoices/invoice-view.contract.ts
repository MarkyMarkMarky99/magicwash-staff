import { z } from 'zod'
import { invoiceViewApiContract } from '../../../contracts/invoices/invoice-view-api.schema.js'
import type { ModuleContract, ModuleDbContract } from '../../shared/contracts/module-db-contract.js'

/**
 * DB contract for the read-only `InvoicesView` materialized view.
 * Authoritative source: G:\My Drive\Magicwash\Database\GoogleSheets\InvoiceView.json
 * KEY ORDER = physical sheet column order.
 */
export const invoiceViewRowSchema = z.object({
  invoiceNumber: z.string(),
  status: z.string(),
  billingType: z.string(),
  billingPeriodStart: z.string().nullable(),
  billingPeriodEnd: z.string().nullable(),
  issuedDate: z.string(),
  dueDate: z.string(),
  customerId: z.string(),
  // customerJson / itemsJson / adjustmentsJson / paymentsJson: serialized JSON
  // text, parsed in invoice-view.transformer.ts — never as Zod here.
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

/** InvoicesView columns are already camelCase; keep the identity map explicit. */
export const invoiceViewFieldMap = {
  invoiceNumber: 'invoiceNumber',
  status: 'status',
  billingType: 'billingType',
  billingPeriodStart: 'billingPeriodStart',
  billingPeriodEnd: 'billingPeriodEnd',
  issuedDate: 'issuedDate',
  dueDate: 'dueDate',
  customerId: 'customerId',
  customerJson: 'customerJson',
  itemsJson: 'itemsJson',
  adjustmentsJson: 'adjustmentsJson',
  paymentsJson: 'paymentsJson',
  subtotal: 'subtotal',
  adjustmentTotal: 'adjustmentTotal',
  grandTotal: 'grandTotal',
  paidAmount: 'paidAmount',
  balanceDue: 'balanceDue',
} as const satisfies Record<keyof z.infer<typeof invoiceViewRowSchema> & string, string>

export type InvoiceViewRow = z.infer<typeof invoiceViewRowSchema>

export const invoiceViewDbContract = {
  row: invoiceViewRowSchema,
  fieldMap: invoiceViewFieldMap,
  primaryKey: 'invoiceNumber',
  request: {}, // no create/update/delete — explicit empty object, not omitted
  response: { read: invoiceViewRowSchema.partial() },
} satisfies ModuleDbContract

export const invoiceViewContract = {
  api: invoiceViewApiContract,
  db: invoiceViewDbContract,
} satisfies ModuleContract
