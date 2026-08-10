import { z } from 'zod'
import type { SheetContract } from '../../shared/contracts/sheet-contract.js'

/** KEY ORDER = physical OrderForm sheet column order. */
export const orderFormRowSchema = z.object({
  id: z.string().min(1),
  order_number: z.string().nullable(),
  customer_id: z.string().min(1),
  received_date: z.string(),
  due_date: z.string(),
  service_type: z.enum(['WSIR', 'IRON']),
  status: z.enum(['PENDING', 'RECEIVED', 'SUBMITTED', 'APPROVED', 'COMPLETED', 'CANCELLED']),
  quantity: z.number().nullable(),
  hangers: z.number().nullable(),
  bags: z.number().nullable(),
  hangers_image: z.string().nullable(),
  bags_image: z.string().nullable(),
  form_image: z.string().nullable(),
  note: z.string().nullable(),
  timestamp: z.string().nullable(),
  created_by: z.string().nullable(),
  updated_at: z.string().nullable(),
  updated_by: z.string().nullable(),
  invoice_id: z.string().nullable(),
  order_name: z.string().nullable(),
  order_description: z.string().nullable(),
})

export const orderFormDbContract = {
  row: orderFormRowSchema,
  // API field: id.
  primaryKey: 'id',
  sheetName: 'OrderForm',
  // M1 in docs/database-layer-sheets-api-refactor-plan.md: this tab's
  // registry workbook differs from the current ORDERS_SPREADSHEET_ID value.
  spreadsheetId: 'ORDERS_SPREADSHEET_ID',
  // Removed in Phase 2 when writes move from SheetLib to the Sheets API.
  target: 'OrderForm',
  // updated_at is intentionally a real Sheets datetime cell, not Plain Text — decision
  // recorded 2026-08-09, same rationale as Invoices' created_at/updated_at/deleted_at (see
  // that file's comment). Must stay USER_ENTERED so §2.9's Sheets API transport preserves
  // this instead of silently reverting to plain text under RAW.
  valueInput: { updated_at: 'USER_ENTERED' },
  writeTransport: 'sheets-api',
  writes: { append: false, update: true, delete: false },
} satisfies SheetContract
