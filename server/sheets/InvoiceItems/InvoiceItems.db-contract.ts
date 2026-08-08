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

/** KEY ORDER = physical InvoiceItems sheet column order. */
export const invoiceItemsRowSchema = z
  .object({
    invoice_number: z.string().min(1),
    invoice_item_id: z.string().length(8),
    item_no: z.number().int().positive(),
    source_order_id: z.string().nullable(),
    source_item_id: z.string().nullable(),
    sku: z.string().nullable(),
    service_type: z.string().nullable(),
    description: z.string().min(1),
    quantity: z.number().positive(),
    unit: z.string().nullable(),
    unit_price: z.number(),
    subtotal: z.number(),
    adjustments: z.array(invoiceAdjustmentSchema).default([]),
    net_total: z.number(),
  })
  .strict()

export const invoiceItemsDbContract = {
  row: invoiceItemsRowSchema,
  // API field: invoiceItemId; the current code field map resolves it to invoice_item_id.
  primaryKey: 'invoice_item_id',
  sheetName: 'InvoiceItems',
  // Removed in Phase 2 when writes move from SheetLib to the Sheets API.
  target: 'InvoiceItem',
  writes: { append: true, update: false, delete: false },
} satisfies SheetContract
