import { z } from 'zod'
import type { SheetContract } from '../../shared/contracts/sheet-contract.js'

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
    // Stored as plain text: the sheet holds a JSON string in this cell, not a
    // structured value. Whoever needs the structure parses it above this layer.
    customer: z.string(),
    adjustments: z.string(),
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
  primaryKey: 'invoice_number',
  sheetName: 'Invoices',
  spreadsheetId: 'INVOICES_SPREADSHEET_ID',
  // Audit timestamps must remain real Sheets datetime cells for spreadsheet sorting and filtering.
  // USER_ENTERED preserves that cell type for Sheets API writes.
  valueInput: { created_at: 'USER_ENTERED', updated_at: 'USER_ENTERED', deleted_at: 'USER_ENTERED' },
  audit: {
    onAppend: ['created_at'],
    onUpdate: [],
  },
  writes: { append: true, update: false, delete: false },
} satisfies SheetContract
