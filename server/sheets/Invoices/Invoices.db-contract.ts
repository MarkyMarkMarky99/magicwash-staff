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
  // API field: invoiceNumber; the current code field map resolves it to invoice_number.
  primaryKey: 'invoice_number',
  sheetName: 'Invoices',
  spreadsheetId: 'INVOICES_SPREADSHEET_ID',
  // created_at/updated_at/deleted_at are intentionally real Sheets datetime cells, not
  // Plain Text — decision recorded 2026-08-09 after a smoke test showed Google Sheets
  // auto-converting the plain-text-formatted stamp into a datetime cell; the project owner
  // chose to keep that behavior (useful for direct-sheet sorting/filtering by other
  // consumers) rather than fight it. Must stay USER_ENTERED so the Sheets API transport
  // preserves this instead of silently reverting to plain text under RAW.
  valueInput: { created_at: 'USER_ENTERED', updated_at: 'USER_ENTERED', deleted_at: 'USER_ENTERED' },
  writes: { append: true, update: false, delete: false },
} satisfies SheetContract
