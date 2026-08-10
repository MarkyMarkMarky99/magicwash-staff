import { z } from 'zod'
import type { SheetContract } from '../../shared/contracts/sheet-contract.js'

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
    // Stored as plain text: a JSON string in the cell, parsed above this layer.
    adjustments: z.string(),
    net_total: z.number(),
  })
  .strict()

export const invoiceItemsDbContract = {
  row: invoiceItemsRowSchema,
  // API field: invoiceItemId; the current code field map resolves it to invoice_item_id.
  primaryKey: 'invoice_item_id',
  sheetName: 'InvoiceItems',
  spreadsheetId: 'INVOICES_SPREADSHEET_ID',
  target: 'InvoiceItem',
  writeTransport: 'sheets-api',
  // No column needs a USER_ENTERED override; all values are plain text/number/enum, not real Sheets date/number types.
  valueInput: {},
  writes: { append: true, update: false, delete: false },
} satisfies SheetContract
