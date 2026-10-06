import type { z } from 'zod'
import type { workTransactionsRowSchema } from '../../sheets/WorkTransactions/WorkTransactions.db-contract.js'
import type { jobTicketsRowSchema } from '../../sheets/JobTickets/JobTickets.db-contract.js'
import { generateShortId } from '../../shared/utils/id.js'

type JobTicketRow = z.infer<typeof jobTicketsRowSchema>
type EarnRow = Omit<z.infer<typeof workTransactionsRowSchema>, 'created_at'>

export function buildEarnRows(tickets: readonly (Partial<JobTicketRow> & Pick<JobTicketRow, 'id'>)[]): EarnRow[] {
  return buildCompletedTicketEarnRows(tickets.filter((ticket) => ticket.department === 'Tagging'))
}

export function buildCompletedTicketEarnRows(tickets: readonly (Partial<JobTicketRow> & Pick<JobTicketRow, 'id'>)[]): EarnRow[] {
  return tickets.flatMap((ticket) =>
    ticket.status === 'Completed'
      && typeof ticket.work_minutes === 'number' && Number.isFinite(ticket.work_minutes)
      && typeof ticket.scanned_by === 'string' && ticket.scanned_by.trim() !== ''
      ? [{
          id: generateShortId(),
          job_ticket_id: ticket.id,
          type: 'EARN' as const,
          minutes: ticket.work_minutes,
          notes: null,
          created_by: ticket.scanned_by,
        }]
      : [],
  )
}
