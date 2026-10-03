import type { z } from 'zod'
import { jobTicketAdvanceRequestSchema, jobTicketAdvanceResponseSchema } from '../../../contracts/job-tickets/job-ticket-api.schema.js'
import { jobTicketsRowSchema } from '../../sheets/JobTickets/JobTickets.db-contract.js'
import { getJobTicketsRepository } from '../../sheets/JobTickets/JobTickets.repository.js'
import { workTransactionsRowSchema } from '../../sheets/WorkTransactions/WorkTransactions.db-contract.js'
import { getWorkTransactionsRepository } from '../../sheets/WorkTransactions/WorkTransactions.repository.js'
import type { ReadQueryDTO } from '../../shared/dtos/read-query.dto.js'
import { parseOrThrow } from '../../shared/http/validate.js'
import type { SheetRowUpdate } from '../../shared/repositories/sheet-repository.contract.js'
import { classifySheetWriteFailure } from '../../shared/repositories/write-failure.js'
import { formatBangkokTimestamp } from '../../shared/utils/bangkok-timestamp.js'
import { generateShortId } from '../../shared/utils/id.js'
import { hasStartedAt } from './job-ticket-started-at.js'

type JobTicketDbRow = z.infer<typeof jobTicketsRowSchema>
type WorkTransactionsDbRow = z.infer<typeof workTransactionsRowSchema>
export type JobTicketAdvanceResponse = z.infer<typeof jobTicketAdvanceResponseSchema>

export interface JobTicketAdvanceRepository {
  read(query?: ReadQueryDTO<Partial<JobTicketDbRow>>): Promise<Array<Partial<JobTicketDbRow>>>
  updateMany(updates: ReadonlyArray<SheetRowUpdate<JobTicketDbRow>>): Promise<unknown>
}

export interface WorkTransactionAppender {
  batchAppend(rows: Array<Partial<WorkTransactionsDbRow>>): Promise<unknown>
}

export interface JobTicketAdvanceServiceOptions {
  repository?: () => JobTicketAdvanceRepository
  workTransactionRepository?: () => WorkTransactionAppender
  now?: () => Date
}

export class JobTicketAdvanceService {
  private readonly repository: () => JobTicketAdvanceRepository
  private readonly workTransactionRepository: () => WorkTransactionAppender
  private readonly now: () => Date

  constructor(input: JobTicketAdvanceServiceOptions = {}) {
    this.repository = input.repository ?? getJobTicketsRepository
    this.workTransactionRepository = input.workTransactionRepository ?? getWorkTransactionsRepository
    this.now = input.now ?? (() => new Date())
  }

  async advance(payload: unknown): Promise<JobTicketAdvanceResponse> {
    const request = parseOrThrow(jobTicketAdvanceRequestSchema, payload)
    const seen = new Set<string>()
    const requested = request.tickets.filter(ticket => {
      if (seen.has(ticket.ticketId)) return false
      seen.add(ticket.ticketId)
      return true
    })
    const repository = this.repository()
    const orders = new Map(await Promise.all([...new Set(requested.map(ticket => ticket.orderId))].map(async orderId => [
      orderId,
      (await repository.read({ where: { order_id: orderId } }))
        .filter(ticket => ticket.deleted_at == null || ticket.deleted_at === ''),
    ] as const)))
    const blocked: Extract<JobTicketAdvanceResponse, { kind: 'completed' }>['blocked'] = []
    const skipped: Extract<JobTicketAdvanceResponse, { kind: 'completed' }>['skipped'] = []
    const advanced: Extract<JobTicketAdvanceResponse, { kind: 'completed' }>['advanced'] = []
    const updates: SheetRowUpdate<JobTicketDbRow>[] = []
    const completed: Array<{ ticketId: string; workMinutes: JobTicketDbRow['work_minutes'] | undefined }> = []
    const timestamp = formatBangkokTimestamp(this.now())

    for (const entry of requested) {
      const orderTickets = orders.get(entry.orderId) ?? []
      const ticket = orderTickets.find(row => row.id === entry.ticketId)
      if (!ticket || ticket.department !== request.department || typeof ticket.step_no !== 'number') {
        skipped.push({ ticketId: entry.ticketId, reason: 'not_found' })
        continue
      }
      if (ticket.status !== request.fromStatus) {
        skipped.push({ ticketId: entry.ticketId, reason: 'status_changed' })
        continue
      }
      const blocker = orderTickets
        .filter(candidate => !!ticket.laundry_item_id
          && candidate.laundry_item_id === ticket.laundry_item_id
          && typeof candidate.step_no === 'number'
          && candidate.step_no < ticket.step_no!
          && candidate.status !== 'Completed')
        .sort((left, right) => (left.step_no ?? 0) - (right.step_no ?? 0))[0]
      if (blocker?.department !== undefined) {
        blocked.push({ ticketId: entry.ticketId, laundryItemId: ticket.laundry_item_id ?? null, blockedByDepartment: blocker.department })
        continue
      }
      const status = request.fromStatus === 'Pending' ? 'In Progress' : 'Completed'
      const startedAt = ticket.started_at ?? timestamp
      const completedAt = status === 'Completed' ? timestamp : ticket.completed_at ?? null
      updates.push({ keyValue: entry.ticketId, patch: {
        status, ...(hasStartedAt(ticket.started_at) ? {} : { started_at: startedAt }),
        ...(status === 'Completed' ? { completed_at: completedAt } : {}),
        scanned_by: request.scannedBy, updated_by: request.scannedBy,
      } })
      if (status === 'Completed') completed.push({ ticketId: entry.ticketId, workMinutes: ticket.work_minutes })
      advanced.push({ ticketId: entry.ticketId, laundryItemId: ticket.laundry_item_id ?? null, status, startedAt, completedAt })
    }

    if (updates.length === 0) return { kind: 'completed', advanced, blocked, skipped, scoreFailed: 0 }
    try {
      await repository.updateMany(updates)
    } catch (error) {
      return { kind: 'write_failed', certainty: classifySheetWriteFailure(error).certainty, blocked, skipped }
    }
    const earnRows: Array<Partial<WorkTransactionsDbRow>> = []
    let scoreFailed = 0
    for (const ticket of completed) {
      if (typeof ticket.workMinutes !== 'number' || !Number.isFinite(ticket.workMinutes)) continue
      earnRows.push({
        id: generateShortId(), job_ticket_id: ticket.ticketId, type: 'EARN',
        minutes: ticket.workMinutes, notes: null, created_by: request.scannedBy,
      })
    }
    if (earnRows.length > 0) {
      try {
        await this.workTransactionRepository().batchAppend(earnRows)
      } catch (error) {
        console.error('Failed to append WorkTransactions', error)
        scoreFailed += earnRows.length
      }
    }
    return { kind: 'completed', advanced, blocked, skipped, scoreFailed }
  }
}
