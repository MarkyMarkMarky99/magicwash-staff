import type { z } from 'zod'
import type { jobTicketsRowSchema } from '../../sheets/JobTickets/JobTickets.db-contract.js'
import { findEarlierJobTicket } from '../../../shared/utils/job-ticket-gating.js'

type Ticket = Partial<z.infer<typeof jobTicketsRowSchema>>

export function findEarlierDepartment(ticket: Ticket, orderTickets: readonly Ticket[]) {
  const project = (row: Ticket) => ({ laundryItemId: row.laundry_item_id, stepNo: row.step_no, status: row.status, department: row.department })
  return findEarlierJobTicket(project(ticket), orderTickets.map(project))?.department
}
