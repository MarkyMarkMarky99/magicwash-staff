import { z } from 'zod'
import type { SheetContract } from '../../shared/contracts/sheet-contract.js'

/** KEY ORDER = physical OrderItemForms sheet column order. */
export const orderItemFormsRowSchema = z
  .object({
    id: z.string(),
    order_id: z.string().nullable(),
    item_id: z.string().nullable(),
    description: z.string().nullable(),
    quantity: z.number().nullable(),
    price: z.number().nullable(),
    credits_used: z.number().nullable(),
    timestamp: z.string().nullable(),
    category: z.string().nullable(),
    service_type: z.string().nullable(),
    special_instructions: z.string().nullable(),
    created_by: z.string().nullable(),
    updated_at: z.string().nullable(),
    updated_by: z.string().nullable(),
    invoice_item_id: z.string().nullable(),
  })
  .strict()

// Append-only: update stays closed until an edit-item screen is specified, and delete has never
// been requested. `timestamp` is the created-timestamp role and is stamped by the repository on
// append; `updated_at` is left unstamped because update is disabled.
//
// Measured 2026-08-30 over all 23,165 rows:
//   - `timestamp` and `updated_at` hold DD/MM/YYYY HH:mm:ss. Appended rows will carry the
//     project's Bangkok yyyy-MM-dd HH:mm:ss instead — the audit stamp format is not negotiable in
//     SheetRepository. New rows therefore differ from historical rows in this column.
//   - Neither timestamp column is declared in valueInput: their cell type (real Sheets datetime vs
//     plain text) was not measured, and the request-wide input option is USER_ENTERED regardless.
//   - `category` (5 spellings) and `service_type` (8 spellings, Thai and English mixed) are free
//     strings on purpose; an enum would be a claim the data does not support.
//   - `invoice_item_id` is empty in all 23,165 rows.
//   - 1,074 rows are blank in every column except `quantity`, which reads 0.0 — a column-E
//     fill-down extends past the real data. They are scattered (row indexes 5 to 20,640) and are
//     returned by read(); `id` comes back null on them. The row schema is never parsed on reads, so
//     nothing throws, and the append key lookup skips blank key cells. Filtering them belongs to a
//     consumer, not to this layer.
//   - `quantity` measures 0 nulls, but only because those 1,074 phantom rows read 0.0. The zero is
//     an artifact of the fill-down, not evidence the column is always populated, so it is typed
//     nullable: removing the fill-down would give it real nulls and silently falsify a
//     non-nullable declaration here and in the schema registry.
export const orderItemFormsDbContract = {
  row: orderItemFormsRowSchema,
  primaryKey: 'id',
  sheetName: 'OrderItemForms',
  spreadsheetId: 'ORDERS_SPREADSHEET_ID',
  audit: { onAppend: ['timestamp'] },
  writes: { append: true, update: false, delete: false },
} satisfies SheetContract
