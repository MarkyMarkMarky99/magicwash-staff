import type { z } from 'zod'
import {
  jobTicketScanRequestSchema,
  jobTicketScanResponseSchema,
} from '../../../contracts/job-tickets/job-ticket-api.schema.js'
import { jobTicketsRowSchema } from '../../sheets/JobTickets/JobTickets.db-contract.js'
import { getJobTicketsRepository } from '../../sheets/JobTickets/JobTickets.repository.js'
import type { ReadQueryDTO } from '../../shared/dtos/read-query.dto.js'
import { parseOrThrow } from '../../shared/http/validate.js'
import { classifySheetWriteFailure } from '../../shared/repositories/write-failure.js'
import { formatBangkokTimestamp } from '../../shared/utils/bangkok-timestamp.js'

type JobTicketDbRow = z.infer<typeof jobTicketsRowSchema>
export type JobTicketScanResponse = z.infer<typeof jobTicketScanResponseSchema>

export interface JobTicketScanRepository {
  read(query?: ReadQueryDTO<Partial<JobTicketDbRow>>): Promise<Array<Partial<JobTicketDbRow>>>
  update(id: string, patch: Partial<JobTicketDbRow>): Promise<unknown>
}

export interface JobTicketScanServiceOptions {
  repository?: () => JobTicketScanRepository
  now?: () => Date
}

export class JobTicketScanService {
  private readonly repository: () => JobTicketScanRepository
  private readonly now: () => Date

  constructor(input: JobTicketScanServiceOptions = {}) {
    this.repository = input.repository ?? getJobTicketsRepository
    this.now = input.now ?? (() => new Date())
  }

  async scan(payload: unknown): Promise<JobTicketScanResponse> {
    const request = parseOrThrow(jobTicketScanRequestSchema, payload)
    const tickets = (await this.repository().read({
      where: { laundry_item_id: request.laundryItemId },
    })).filter((ticket) => ticket.deleted_at == null || ticket.deleted_at === '')
    const ticket = tickets.find((candidate) => candidate.department === request.department)

    if (ticket?.id === undefined || ticket.step_no === undefined) {
      return {
        kind: 'not_found',
        laundryItemId: request.laundryItemId,
        department: request.department,
      }
    }

    if (ticket.status === 'Completed') {
      return { kind: 'already_completed', ticketId: ticket.id }
    }

    const blocker = tickets
      .filter((candidate) =>
        typeof candidate.step_no === 'number'
        && candidate.step_no < ticket.step_no!
        && candidate.status !== 'Completed',
      )
      .sort((left, right) => (left.step_no ?? 0) - (right.step_no ?? 0))[0]

    if (blocker?.department !== undefined) {
      return {
        kind: 'blocked',
        laundryItemId: request.laundryItemId,
        department: request.department,
        blockedByDepartment: blocker.department,
      }
    }

    if (ticket.status !== 'Pending' && ticket.status !== 'In Progress') {
      return {
        kind: 'not_found',
        laundryItemId: request.laundryItemId,
        department: request.department,
      }
    }

    const timestamp = formatBangkokTimestamp(this.now())
    const nextStatus = ticket.status === 'Pending' ? 'In Progress' : 'Completed'
    const startedAt = ticket.started_at ?? timestamp
    const completedAt = nextStatus === 'Completed' ? timestamp : ticket.completed_at ?? null

    try {
      await this.repository().update(ticket.id, {
        status: nextStatus,
        started_at: startedAt,
        ...(nextStatus === 'Completed' ? { completed_at: completedAt } : {}),
        scanned_by: request.scannedBy,
        updated_by: request.scannedBy,
      })
    } catch (error) {
      return {
        kind: 'write_failed',
        ticketId: ticket.id,
        certainty: classifySheetWriteFailure(error).certainty,
      }
    }

    return {
      kind: 'advanced',
      ticketId: ticket.id,
      status: nextStatus,
      startedAt,
      completedAt,
    }
  }
}
