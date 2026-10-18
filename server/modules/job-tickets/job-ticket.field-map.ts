import type { z } from 'zod'
import type { jobTicketsRowSchema } from '../../sheets/JobTickets/JobTickets.db-contract.js'

type JobTicketDbRow = z.infer<typeof jobTicketsRowSchema>

export const jobTicketFieldMap = {
  id: 'id',
  order_id: 'orderId',
  laundry_item_id: 'laundryItemId',
  scope: 'scope',
  task_code: 'taskCode',
  department: 'department',
  step_no: 'stepNo',
  customer_id: 'customerId',
  order_name: 'orderName',
  due_date: 'dueDate',
  special_instructions: 'specialInstructions',
  notes: 'notes',
  status: 'status',
  started_at: 'startedAt',
  completed_at: 'completedAt',
  scanned_by: 'scannedBy',
  photo_evidence_url: 'photoEvidenceUrl',
  created_at: 'createdAt',
  created_by: 'createdBy',
  updated_at: 'updatedAt',
  updated_by: 'updatedBy',
  deleted_at: 'deletedAt',
  deleted_by: 'deletedBy',
  work_minutes: 'workMinutes',
} as const satisfies Record<keyof JobTicketDbRow & string, string>
