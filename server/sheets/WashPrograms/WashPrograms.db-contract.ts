import { z } from 'zod'
import type { SheetContract } from '../../shared/contracts/sheet-contract.js'

export const washProgramsRowSchema = z.object({
  id: z.string(),
  program_id: z.string(),
  program_name: z.string(),
  step_no: z.number(),
  step_type: z.enum(['stain_removal', 'quick_wash', 'normal_wash', 'rinse', 'soak']),
  products: z.string().nullable(),
  temperature: z.enum(['cold', '40', '60']).nullable(),
  duration: z.string().nullable(),
  status: z.enum(['ACTIVE', 'INACTIVE']),
  sort_order: z.number().nullable(),
  created_at: z.string(),
  updated_at: z.string().nullable(),
}).strict()
export const washProgramsDbContract = {
  row: washProgramsRowSchema, primaryKey: 'id', sheetName: 'WashPrograms',
  spreadsheetId: 'JOB_TICKETS_SPREADSHEET_ID',
  writes: { append: false, update: false, delete: false },
} satisfies SheetContract
