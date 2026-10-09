import type { z } from 'zod'
import {
  jobTicketStartOrderRequestSchema,
  jobTicketStartOrderResponseSchema,
} from '../../../contracts/job-tickets/job-ticket-api.schema.js'
import { jobTicketsRowSchema } from '../../sheets/JobTickets/JobTickets.db-contract.js'
import { getJobTicketsRepository } from '../../sheets/JobTickets/JobTickets.repository.js'
import type { SheetRowUpdate } from '../../shared/repositories/sheet-repository.contract.js'
import type { ReadQueryDTO } from '../../shared/dtos/read-query.dto.js'
import { parseOrThrow } from '../../shared/http/validate.js'

import { JobTicketTransitionService } from './job-ticket-transition.service.js'

type JobTicketDbRow = z.infer<typeof jobTicketsRowSchema>
export type JobTicketStartOrderResponse = z.infer<typeof jobTicketStartOrderResponseSchema>

export interface JobTicketStartRepository {
  read(query?: ReadQueryDTO<Partial<JobTicketDbRow>>): Promise<Array<Partial<JobTicketDbRow>>>
  updateMany(updates: ReadonlyArray<SheetRowUpdate<JobTicketDbRow>>): Promise<unknown>
}

export interface JobTicketStartServiceOptions {
  repository?: () => JobTicketStartRepository
  now?: () => Date
}

export class JobTicketStartService {
  private readonly repository: () => JobTicketStartRepository
  private readonly now: () => Date

  constructor(input: JobTicketStartServiceOptions = {}) {
    this.repository = input.repository ?? getJobTicketsRepository
    this.now = input.now ?? (() => new Date())
  }

  async startOrder(payload: unknown): Promise<JobTicketStartOrderResponse> {
    const request = parseOrThrow(jobTicketStartOrderRequestSchema, payload)
    const repository = this.repository()
    const tickets = (await repository.read({ where: { order_id: request.orderId } }))
      .filter(ticket => ticket.deleted_at == null || ticket.deleted_at === '')
    const pending = tickets.filter(ticket => String(ticket.order_id) === request.orderId
      && ticket.department === request.department && ticket.status === 'Pending')
    const skippedWithoutTag = pending.filter(ticket => !ticket.laundry_item_id).length
    const result = await new JobTicketTransitionService({ repository: () => repository, now: this.now }).transition({
      department: request.department, targetStatus: 'In Progress', allowedSourceStatuses: ['Pending'],
      scannedBy: request.scannedBy,
      tickets: pending.filter(ticket => ticket.laundry_item_id && ticket.id && typeof ticket.step_no === 'number')
        .map(ticket => ({ ticketId: ticket.id, orderId: request.orderId })),
    }, tickets)
    const blocked = result.blocked.map(entry => ({ ...entry, laundryItemId: entry.laundryItemId! }))
    if (result.kind === 'write_failed') return { kind: 'write_failed', certainty: result.certainty, blocked, skippedWithoutTag }
    const advanced = result.advanced.map(entry => ({ ticketId: entry.ticketId, laundryItemId: entry.laundryItemId!,
      status: 'In Progress' as const, startedAt: entry.startedAt }))
    return { kind: 'completed', advanced, blocked, skippedWithoutTag }
  }
}
