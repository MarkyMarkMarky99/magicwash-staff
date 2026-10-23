import { z } from 'zod'
import type { SheetContract } from '../../shared/contracts/sheet-contract.js'

export const laundryItemPhotosRowSchema = z.object({
  id: z.string(),
  laundry_item_id: z.string().regex(/^[0-9A-Za-z]{8}$/),
  order_id: z.string().nullable(),
  photo_type: z.enum(['REGISTRATION', 'BEFORE', 'AFTER', 'DEFECT']),
  image_url: z.string(),
  notes: z.string().nullable(),
  created_at: z.string(),
  created_by: z.string(),
  updated_at: z.string().nullable(),
  updated_by: z.string().nullable(),
  deleted_at: z.string().nullable(),
  deleted_by: z.string().nullable(),
}).strict()

export const laundryItemPhotosDbContract = {
  row: laundryItemPhotosRowSchema,
  primaryKey: 'id',
  sheetName: 'LaundryItemPhotos',
  spreadsheetId: 'LAUNDRY_ITEMS_SPREADSHEET_ID',
  audit: { onAppend: ['created_at'], onUpdate: ['updated_at'] },
  writes: { append: true, update: true, delete: false },
} satisfies SheetContract
