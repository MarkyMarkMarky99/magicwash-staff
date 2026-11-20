import { z } from 'zod'
import type { SheetContract } from '../../shared/contracts/sheet-contract.js'

export const stockTakeEntriesRowSchema = z.object({
  id: z.string(),
  stock_take_id: z.string(),
  kind: z.enum(['SCAN', 'RESOLUTION', 'PLAN']),
  order_id: z.string().nullable(),
  laundry_item_id: z.string(),
  bag_id: z.string().nullable(),
  department: z.enum(['Washing', 'DryCleaning', 'Ironing', 'Packaging']).nullable(),
  status: z.enum(['Pending', 'In Progress', 'Packed']).nullable(),
  resolution: z.enum(['RETURNED', 'OFF_SITE', 'LOST', 'KEEP_LOOKING', 'LINK_CONFIRMED', 'TASK_PICK']).nullable(),
  reason: z.string().nullable(),
  job_ticket_id: z.string().nullable(),
  plan_state: z.enum(['PLANNED', 'APPLIED', 'SKIPPED', 'SUPERSEDED']).nullable(),
  baseline: z.string().nullable(),
  patch: z.string().nullable(),
  created_at: z.string(),
  created_by: z.string(),
  updated_at: z.string().nullable(),
}).strict()

export const stockTakeEntriesDbContract = {
  row: stockTakeEntriesRowSchema,
  primaryKey: 'id',
  sheetName: 'StockTakeEntries',
  spreadsheetId: 'JOB_TICKETS_SPREADSHEET_ID',
  audit: { onAppend: ['created_at'], onUpdate: ['updated_at'] },
  writes: { append: true, update: true, delete: false },
} satisfies SheetContract
