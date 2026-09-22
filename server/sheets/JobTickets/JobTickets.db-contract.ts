import { z } from 'zod'
import type { SheetContract } from '../../shared/contracts/sheet-contract.js'

export const jobTicketScopeSchema = z.enum(['ITEM', 'ORDER'])
export const jobTicketServiceTypeSchema = z.enum(['WSIR', 'IRON', 'DRCL', 'WASH'])
export const jobTicketDepartmentSchema = z.enum([
  'Tagging',
  'Washing',
  'DryCleaning',
  'Ironing',
  'Packaging',
  'Logistics',
])
export const jobTicketStatusSchema = z.enum(['Pending', 'In Progress', 'Completed', 'Cancelled'])

export const jobTicketsRowSchema = z
  .object({
    id: z.string().min(1),
    order_id: z.string().min(1),
    laundry_item_id: z.string().min(1),
    scope: jobTicketScopeSchema,
    service_type: jobTicketServiceTypeSchema.nullable(),
    department: jobTicketDepartmentSchema,
    step_no: z.number().int().min(1),
    customer_id: z.string().nullable(),
    order_name: z.string().nullable(),
    due_date: z.string().nullable(),
    special_instructions: z.string().nullable(),
    notes: z.string().nullable(),
    status: jobTicketStatusSchema,
    started_at: z.string().nullable(),
    completed_at: z.string().nullable(),
    scanned_by: z.string().nullable(),
    photo_evidence_url: z.string().nullable(),
    created_at: z.string().nullable(),
    created_by: z.string().nullable(),
    updated_at: z.string().nullable(),
    updated_by: z.string().nullable(),
    deleted_at: z.string().nullable(),
    deleted_by: z.string().nullable(),
  })
  .strict()

export const jobTicketsDbContract = {
  row: jobTicketsRowSchema,
  primaryKey: 'id',
  sheetName: 'JobTickets',
  spreadsheetId: 'JOB_TICKETS_SPREADSHEET_ID',
  audit: {
    onAppend: ['created_at'],
    onUpdate: ['updated_at'],
  },
  writes: { append: true, update: true, delete: false },
} satisfies SheetContract
