import { z } from 'zod'
import type { SheetContract } from '../../shared/contracts/sheet-contract.js'

/** KEY ORDER = physical LaundryPhotos sheet column order. */
export const laundryPhotosRowSchema = z
  .object({
    id: z.string(),
    order_id: z.string().nullable(),
    orderitem_id: z.string().nullable(),
    item_id: z.string().nullable(),
    image_path: z.string().nullable(),
    image_url: z.string().nullable(),
    notes: z.string().nullable(),
    timestamp: z.string().nullable(),
    created_by: z.string().nullable(),
    updated_by: z.string().nullable(),
    updated_at: z.string().nullable(),
    checked: z.boolean().nullable(),
    is_active: z.boolean().nullable(),
    file_id: z.string().nullable(),
    deleted_at: z.string().nullable(),
    deleted_by: z.string().nullable(),
  })
  .strict()

// Append and update are open for photo creation and reassignment; delete stays closed.
// Measured 2026-09-07: `timestamp` and `deleted_at` are Sheets
// datetime cells (`dd/MM/yyyy HH:mm:ss` and `yyyy-MM-dd hh:mm:ss` respectively), while
// `updated_at` is plain text in DD/MM/YYYY. Future writes must never include `updated_at`, because
// the USER_ENTERED Sheets path would reinterpret the day and month.
export const laundryPhotosDbContract = {
  row: laundryPhotosRowSchema,
  primaryKey: 'id',
  sheetName: 'LaundryPhotos',
  spreadsheetId: 'ORDERS_SPREADSHEET_ID',
  audit: { onAppend: ['timestamp'] },
  writes: { append: true, update: true, delete: false },
} satisfies SheetContract
