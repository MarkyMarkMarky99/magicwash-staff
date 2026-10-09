import { z } from 'zod'
import { jobTicketDepartmentSchema, jobTicketAdvanceResponseSchema } from '../../../contracts/job-tickets/job-ticket-api.schema.js'
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
import { findEarlierDepartment } from './job-ticket-gating.js'
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

export interface JobTicketTransitionServiceOptions {
  repository?: () => JobTicketAdvanceRepository
  workTransactionRepository?: () => WorkTransactionAppender
  now?: () => Date
}

const transitionRequestSchema = z.object({
  department: jobTicketDepartmentSchema,
  tickets: z.array(z.object({ ticketId: z.string().trim().min(1), orderId: z.string().trim().min(1) })),
  targetStatus: z.enum(['In Progress', 'Completed']),
  allowedSourceStatuses: z.array(z.enum(['Pending', 'In Progress'])).min(1),
  scannedBy: z.string().trim().min(1),
})

export class JobTicketTransitionService {
  private readonly repository: () => JobTicketAdvanceRepository
  private readonly workTransactionRepository: () => WorkTransactionAppender
  private readonly now: () => Date

  constructor(input: JobTicketTransitionServiceOptions = {}) {
    this.repository = input.repository ?? getJobTicketsRepository
    this.workTransactionRepository = input.workTransactionRepository ?? getWorkTransactionsRepository
    this.now = input.now ?? (() => new Date())
  }

  async transition(
    payload: unknown,
    alreadyRead?: readonly Partial<JobTicketDbRow>[],
    options: { skipGating?: boolean; skipScores?: boolean } = {},
  ): Promise<JobTicketAdvanceResponse> {
    const request = parseOrThrow(transitionRequestSchema, payload)
    const seen = new Set<string>()
    const requested = request.tickets.filter(ticket => {
      if (seen.has(ticket.ticketId)) return false
      seen.add(ticket.ticketId)
      return true
    })
    const repository = this.repository()
    const orders = alreadyRead === undefined ? await this.readOrderTickets(repository, requested)
      : new Map([...new Set(requested.map(entry => entry.orderId))].map(orderId => [orderId,
        alreadyRead.filter(ticket => String(ticket.order_id ?? '') === orderId && !ticket.deleted_at)]))
    const blocked: Extract<JobTicketAdvanceResponse, { kind: 'completed' }>['blocked'] = []
    const skipped: Extract<JobTicketAdvanceResponse, { kind: 'completed' }>['skipped'] = []
    const advanced: Extract<JobTicketAdvanceResponse, { kind: 'completed' }>['advanced'] = []
    const updates: SheetRowUpdate<JobTicketDbRow>[] = []
    const completed: Array<{ ticketId: string; workMinutes: JobTicketDbRow['work_minutes'] | undefined }> = []
    const timestamp = formatBangkokTimestamp(this.now())

    for (const entry of requested) {
      const orderTickets = orders.get(entry.orderId) ?? []
      const ticket = orderTickets.find(row => row.id === entry.ticketId)
      if (!ticket || ticket.department !== request.department || (!options.skipGating && typeof ticket.step_no !== 'number')) {
        skipped.push({ ticketId: entry.ticketId, reason: 'not_found' })
        continue
      }
      if (!request.allowedSourceStatuses.includes(ticket.status as 'Pending' | 'In Progress')) {
        skipped.push({ ticketId: entry.ticketId, reason: 'status_changed' })
        continue
      }
      const blocker = options.skipGating ? null : findEarlierDepartment(ticket, orderTickets)
      if (blocker !== undefined && blocker !== null) {
        blocked.push({ ticketId: entry.ticketId, laundryItemId: ticket.laundry_item_id ?? null, blockedByDepartment: blocker })
        continue
      }
      const status = request.targetStatus
      const startedAt = hasStartedAt(ticket.started_at) ? ticket.started_at! : timestamp
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
    const scoreFailed = options.skipScores ? 0 : await this.appendScores(completed, request.scannedBy)
    return { kind: 'completed', advanced, blocked, skipped, scoreFailed }
  }

  // Gating needs only tickets that are not Completed; three status reads cover any number of orders.
  private async readOrderTickets(
    repository: JobTicketAdvanceRepository,
    requested: ReadonlyArray<{ ticketId: string; orderId: string }>,
  ): Promise<Map<string, Array<Partial<JobTicketDbRow>>>> {
    const live = (ticket: Partial<JobTicketDbRow>) => ticket.deleted_at == null || ticket.deleted_at === ''
    const orderIds = new Set(requested.map(ticket => ticket.orderId))
    const unfinished = (await Promise.all((['Pending', 'In Progress', 'Cancelled'] as const)
      .map(status => repository.read({ where: { status } })))).flat()
    const orders = new Map([...orderIds].map(orderId => [orderId, [] as Array<Partial<JobTicketDbRow>>]))
    for (const ticket of unfinished) {
      // GViz can type a numeric-looking order id as a number.
      const orderId = ticket.order_id == null ? '' : String(ticket.order_id)
      if (live(ticket) && orderIds.has(orderId)) orders.get(orderId)!.push(ticket)
    }
    // A requested ticket outside these reads was completed or never existed; read its order in full
    // so the skip reason stays exact.
    const missing = new Set(requested
      .filter(entry => !orders.get(entry.orderId)!.some(ticket => ticket.id === entry.ticketId))
      .map(entry => entry.orderId))
    await Promise.all([...missing].map(async orderId => {
      orders.set(orderId, (await repository.read({ where: { order_id: orderId } }))
        .filter(ticket => live(ticket) && String(ticket.order_id ?? '') === orderId))
    }))
    return orders
  }

  private async appendScores(completed: Array<{ ticketId: string; workMinutes: JobTicketDbRow['work_minutes'] | undefined }>, actor: string): Promise<number> {
    const earnRows: Array<Partial<WorkTransactionsDbRow>> = []
    let scoreFailed = 0
    for (const ticket of completed) {
      if (typeof ticket.workMinutes !== 'number' || !Number.isFinite(ticket.workMinutes)) continue
      earnRows.push({
        id: generateShortId(), job_ticket_id: ticket.ticketId, type: 'EARN',
        minutes: ticket.workMinutes, notes: null, created_by: actor,
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
    return scoreFailed
  }
}
