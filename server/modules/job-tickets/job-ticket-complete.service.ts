import type { z } from 'zod'
import { jobTicketCompleteOrderRequestSchema, jobTicketCompleteOrderResponseSchema } from '../../../contracts/job-tickets/job-ticket-api.schema.js'
import { isDepartmentWorkTicket } from '../../../shared/job-tickets/department-work.js'
import { getJobTicketsRepository } from '../../sheets/JobTickets/JobTickets.repository.js'
import { parseOrThrow } from '../../shared/http/validate.js'
import { JobTicketTransitionService, type JobTicketTransitionServiceOptions } from './job-ticket-transition.service.js'

export type JobTicketCompleteOrderResponse = z.infer<typeof jobTicketCompleteOrderResponseSchema>

export class JobTicketCompleteService {
  constructor(private readonly options: JobTicketTransitionServiceOptions = {}) {}

  async completeOrder(payload: unknown, actor: string): Promise<JobTicketCompleteOrderResponse> {
    const request = parseOrThrow(jobTicketCompleteOrderRequestSchema, payload)
    const repository = (this.options.repository ?? getJobTicketsRepository)()
    const tickets = await repository.read({ where: { order_id: request.orderId } })
    const open = tickets.filter(ticket => String(ticket.order_id ?? '') === request.orderId
      && !ticket.deleted_at && ticket.department === request.department
      && (ticket.status === 'Pending' || ticket.status === 'In Progress')
      && isDepartmentWorkTicket({ scope: ticket.scope, department: ticket.department,
        taskCode: ticket.task_code, deletedAt: ticket.deleted_at }, request.department))
    const result = await new JobTicketTransitionService({ ...this.options, repository: () => repository }).transition({
      department: request.department, targetStatus: 'Completed', allowedSourceStatuses: ['Pending', 'In Progress'],
      scannedBy: actor, tickets: open.map(ticket => ({ ticketId: ticket.id, orderId: request.orderId })),
    }, tickets, { skipGating: true, skipScores: true })
    if (result.kind === 'write_failed') return { kind: 'write_failed', certainty: result.certainty }
    return { kind: 'completed', scannedBy: actor,
      completed: result.advanced.map(ticket => ({ ticketId: ticket.ticketId, status: 'Completed',
        startedAt: ticket.startedAt!, completedAt: ticket.completedAt! })) }
  }
}
