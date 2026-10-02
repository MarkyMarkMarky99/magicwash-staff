import type { z } from 'zod'
import {
  jobTicketStartOrderRequestSchema,
  jobTicketStartOrderResponseSchema,
} from '../../../contracts/job-tickets/job-ticket-api.schema.js'
import { jobTicketsRowSchema } from '../../sheets/JobTickets/JobTickets.db-contract.js'
import { getJobTicketsRepository } from '../../sheets/JobTickets/JobTickets.repository.js'
import type { ReadQueryDTO } from '../../shared/dtos/read-query.dto.js'
import { parseOrThrow } from '../../shared/http/validate.js'
import type { SheetRowUpdate } from '../../shared/repositories/sheet-repository.contract.js'
import { classifySheetWriteFailure } from '../../shared/repositories/write-failure.js'
import { formatBangkokTimestamp } from '../../shared/utils/bangkok-timestamp.js'

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
    const blocked: Extract<JobTicketStartOrderResponse, { kind: 'completed' }>['blocked'] = []
    const updates: SheetRowUpdate<JobTicketDbRow>[] = []
    const advanced: Extract<JobTicketStartOrderResponse, { kind: 'completed' }>['advanced'] = []
    let skippedWithoutTag = 0
    const timestamp = formatBangkokTimestamp(this.now())

    for (const ticket of tickets) {
      if (ticket.department !== request.department || ticket.status !== 'Pending') continue
      if (!ticket.laundry_item_id) {
        skippedWithoutTag += 1
        continue
      }
      if (ticket.id === undefined || typeof ticket.step_no !== 'number') continue

      const blocker = tickets
        .filter(candidate => candidate.laundry_item_id === ticket.laundry_item_id
          && typeof candidate.step_no === 'number'
          && candidate.step_no < ticket.step_no!
          && candidate.status !== 'Completed')
        .sort((left, right) => (left.step_no ?? 0) - (right.step_no ?? 0))[0]
      if (blocker?.department !== undefined) {
        blocked.push({
          ticketId: ticket.id,
          laundryItemId: ticket.laundry_item_id,
          blockedByDepartment: blocker.department,
        })
        continue
      }

      const startedAt = ticket.started_at ?? timestamp
      updates.push({
        keyValue: ticket.id,
        patch: {
          status: 'In Progress', started_at: startedAt,
          scanned_by: request.scannedBy, updated_by: request.scannedBy,
        },
      })
      advanced.push({
        ticketId: ticket.id, laundryItemId: ticket.laundry_item_id,
        status: 'In Progress', startedAt,
      })
    }

    if (updates.length === 0) return { kind: 'completed', advanced, blocked, skippedWithoutTag }

    try {
      await repository.updateMany(updates)
    } catch (error) {
      return {
        kind: 'write_failed', certainty: classifySheetWriteFailure(error).certainty,
        blocked, skippedWithoutTag,
      }
    }
    return { kind: 'completed', advanced, blocked, skippedWithoutTag }
  }
}
