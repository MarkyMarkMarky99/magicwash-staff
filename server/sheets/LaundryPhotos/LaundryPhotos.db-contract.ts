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

// Read-only until the photos module lands: writes still go through Apps Script, and moving them
// to the Sheets API is blocked on API authentication. Measured 2026-08-15: `timestamp` and
// `deleted_at` are real Sheets datetime cells and will need valueInput 'USER_ENTERED' when
// append opens; `updated_at` is plain text in DD/MM/YYYY and must NOT be sent as USER_ENTERED,
// which would reinterpret day and month.
export const laundryPhotosDbContract = {
  row: laundryPhotosRowSchema,
  primaryKey: 'id',
  sheetName: 'LaundryPhotos',
  spreadsheetId: 'ORDERS_SPREADSHEET_ID',
  writes: { append: false, update: false, delete: false },
} satisfies SheetContract
