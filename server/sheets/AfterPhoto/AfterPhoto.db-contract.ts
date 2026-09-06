import { z } from 'zod'
import type { SheetContract } from '../../shared/contracts/sheet-contract.js'

/** KEY ORDER = physical after sheet column order. */
export const afterPhotoRowSchema = z
  .object({
    id: z.string(),
    order_id: z.string().nullable(),
    orderitem_id: z.string().nullable(),
    item_id: z.string().nullable(),
    image_path: z.string().nullable(),
    image_url: z.string().nullable(),
    notes: z.string().nullable(),
    created_at: z.string().nullable(),
    created_by: z.string().nullable(),
    updated_by: z.string().nullable(),
    updated_at: z.string().nullable(),
    checked: z.string().nullable(),
    is_active: z.string().nullable(),
    file_id: z.string().nullable(),
    deleted_at: z.string().nullable(),
    deleted_by: z.string().nullable(),
  })
  .strict()

// Update is open for reassignment; append and delete stay closed because photo creation and
// removal remain outside this API. Measured 2026-09-07: `created_at` is a Sheets datetime in
// yyyy-MM-dd hh:mm:ss form; all remaining non-id columns read as strings, including checked,
// is_active, updated_at, and the deletion fields.
export const afterPhotoDbContract = {
  row: afterPhotoRowSchema,
  primaryKey: 'id',
  sheetName: 'after',
  spreadsheetId: 'AFTER_PHOTOS_SPREADSHEET_ID',
  writes: { append: false, update: true, delete: false },
} satisfies SheetContract
