import { z } from 'zod'
import type { SheetContract } from '../../shared/contracts/sheet-contract.js'

/** KEY ORDER = physical OrderImages sheet column order. */
export const orderImagesRowSchema = z
  .object({
    id: z.string(),
    customer_id: z.string().nullable(),
    delivery_id: z.string().nullable(),
    order_id: z.string(),
    image_type: z.string().nullable(),
    image_path: z.string().nullable(),
    notes: z.string().nullable(),
    quantity: z.number().nullable(),
    created_at: z.string().nullable(),
    created_by: z.string().nullable(),
  })
  .strict()

// Append-only: update stays closed until an edit-image screen is specified, and delete has never
// been requested. `created_at` is the created-timestamp role and is stamped by the repository on
// append.
//
// Measured 2026-08-30 over all 17,376 rows:
//   - `created_at` reads back as ISO with a Z suffix on newer rows and DD/MM/YYYY HH:mm:ss on
//     older ones. Appended rows will carry the project's Bangkok yyyy-MM-dd HH:mm:ss, a third
//     shape. It is not declared in valueInput: the column is demonstrably mixed, so it cannot be
//     called a measured Sheets datetime cell, and the request-wide input option is USER_ENTERED
//     regardless.
//   - `image_type` is a free string, not an enum: 13 spellings occur, including BAG/BAGS / BASKETS,
//     HANGER/HANGERS and DOCUMENT/Document, plus 1,329 blanks.
//   - `image_path` holds two incompatible formats: full Firebase Storage download URLs on newer
//     rows and legacy relative paths such as OrderForm_Images/<id>.form_image.<n>.jpg. Kept a plain
//     nullable string; a URL validator would reject a large share of existing rows and normalising
//     belongs in a module mapper.
//   - `quantity` is a decimal weight (20.5, 8.7), blank on 13,258 rows.
//   - `order_id` has zero nulls across all rows and is therefore not nullable.
export const orderImagesDbContract = {
  row: orderImagesRowSchema,
  primaryKey: 'id',
  sheetName: 'OrderImages',
  spreadsheetId: 'ORDERS_SPREADSHEET_ID',
  audit: { onAppend: ['created_at'] },
  writes: { append: true, update: false, delete: false },
} satisfies SheetContract
