import { z } from 'zod'
import type { SheetContract } from '../../shared/contracts/sheet-contract.js'

export const washQueueRowSchema = z.object({
  id: z.string(),
  status: z.enum(['Pending', 'In Progress', 'Completed', 'Collected', 'Cancelled']),
  photo_url: z.string(),
  instruction: z.string().nullable(),
  work_minutes: z.number().nullable(),
  loaded_at: z.string().nullable(),
  loaded_by: z.string().nullable(),
  unloaded_at: z.string().nullable(),
  unloaded_by: z.string().nullable(),
  collected_at: z.string().nullable(),
  collected_by: z.string().nullable(),
  cancelled_at: z.string().nullable(),
  cancelled_by: z.string().nullable(),
  created_at: z.string(),
  created_by: z.string(),
  updated_at: z.string(),
  updated_by: z.string(),
  weight_before_kg: z.number().nullable(),
  weight_after_kg: z.number().nullable(),
  unload_photo_url: z.string().nullable(),
  machine_id: z.string().nullable(),
  tag_code: z.string().nullable(),
  wash_options: z.string().nullable(),
}).strict()
export const washQueueDbContract = {
  row: washQueueRowSchema,
  primaryKey: 'id',
  sheetName: 'WashQueue',
  spreadsheetId: 'JOB_TICKETS_SPREADSHEET_ID',
  audit: { onAppend: ['created_at', 'updated_at'], onUpdate: ['updated_at'] },
  writes: { append: true, update: true, delete: false },
} satisfies SheetContract
