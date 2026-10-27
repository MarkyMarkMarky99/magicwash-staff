import { z } from 'zod'
import type { SheetContract } from '../../shared/contracts/sheet-contract.js'

/** Key order is the physical Attendance A:K column order. */
export const attendanceRowSchema = z.object({
  id: z.string(),
  staff_id: z.string(),
  work_date: z.string(),
  status: z.enum(['DAY_OFF', 'LEAVE', 'ABSENT']),
  notes: z.string().nullable(),
  created_at: z.string(),
  created_by: z.string(),
  updated_at: z.string().nullable(),
  updated_by: z.string().nullable(),
  deleted_at: z.string().nullable(),
  deleted_by: z.string().nullable(),
}).strict()

export type AttendanceRow = z.infer<typeof attendanceRowSchema>

export const attendanceDbContract = {
  row: attendanceRowSchema,
  primaryKey: 'id',
  sheetName: 'Attendance',
  spreadsheetId: 'STAFF_SPREADSHEET_ID',
  audit: { onAppend: ['created_at'], onUpdate: ['updated_at'] },
  writes: { append: true, update: true, delete: false },
} satisfies SheetContract
