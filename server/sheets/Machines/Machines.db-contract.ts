import { z } from 'zod'
import type { SheetContract } from '../../shared/contracts/sheet-contract.js'

export const machinesRowSchema = z.object({
  id: z.string(),
  type: z.enum(['WSH', 'DRY']),
  name: z.string(),
  capacity_kg: z.number().nullable(),
  status: z.enum(['ACTIVE', 'MAINTENANCE', 'RETIRED']),
  sort_order: z.number().nullable(),
  note: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string().nullable(),
}).strict()
export const machinesDbContract = {
  row: machinesRowSchema,
  primaryKey: 'id',
  sheetName: 'Machines',
  spreadsheetId: 'JOB_TICKETS_SPREADSHEET_ID',
  writes: { append: false, update: false, delete: false },
} satisfies SheetContract
