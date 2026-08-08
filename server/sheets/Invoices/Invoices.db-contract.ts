import { z } from 'zod'
import type { SheetContract } from '../../shared/contracts/sheet-contract.js'

const invoiceAdjustmentCalculationSchema = z.enum(['FIXED', 'PERCENT'])

const invoiceAdjustmentSchema = z
  .object({
    label: z.string().min(1),
    calculation: invoiceAdjustmentCalculationSchema,
    value: z.number().refine((value) => value !== 0, 'adjustment value must not be 0'),
    ref_source: z.string().min(1).optional(),
    ref_code: z.string().min(1).optional(),
  })
  .strict()
  .refine(
    (adjustment) => (adjustment.ref_source === undefined) === (adjustment.ref_code === undefined),
    { message: 'ref_source and ref_code must both be present or both be omitted' },
  )

const invoiceCustomerSnapshotSchema = z
  .object({
    customer_code: z.string().min(1),
    customer_name: z.string().min(1),
    phone: z.string().min(1).optional(),
    address: z.string().min(1).optional(),
  })
  .strict()

const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'must be a YYYY-MM-DD date')
const invoiceStatusSchema = z.enum(['DRAFT', 'ISSUED', 'CANCELLED', 'VOID'])

/** KEY ORDER = physical Invoices sheet column order. */
export const invoicesRowSchema = z
  .object({
    invoice_number: z.string().min(1),
    status: invoiceStatusSchema,
    billing_type: z.enum(['ORDER', 'CYCLE']),
    billing_period_start: z.string().nullable(),
    billing_period_end: z.string().nullable(),
    issued_date: isoDateSchema,
    due_date: isoDateSchema,
    customer_id: z.string().min(1),
    customer: invoiceCustomerSnapshotSchema,
    adjustments: z.array(invoiceAdjustmentSchema).default([]),
    created_by: z.string().min(1),
    created_at: z.string().nullable(),
    updated_at: z.string().nullable(),
    updated_by: z.string().nullable(),
    deleted_at: z.string().nullable(),
    deleted_by: z.string().nullable(),
  })
  .strict()

export const invoicesDbContract = {
  row: invoicesRowSchema,
  // API field: invoiceNumber; the current code field map resolves it to invoice_number.
  primaryKey: 'invoice_number',
  sheetName: 'Invoices',
  // Removed in Phase 2 when writes move from SheetLib to the Sheets API.
  target: 'Invoice',
  writes: { append: true, update: false, delete: false },
} satisfies SheetContract
