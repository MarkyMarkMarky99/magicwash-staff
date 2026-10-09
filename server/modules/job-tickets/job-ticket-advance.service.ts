import type { z } from 'zod'
import { jobTicketAdvanceRequestSchema, jobTicketAdvanceResponseSchema } from '../../../contracts/job-tickets/job-ticket-api.schema.js'
import { jobTicketsRowSchema } from '../../sheets/JobTickets/JobTickets.db-contract.js'
import { getJobTicketsRepository } from '../../sheets/JobTickets/JobTickets.repository.js'
import { workTransactionsRowSchema } from '../../sheets/WorkTransactions/WorkTransactions.db-contract.js'
import { getWorkTransactionsRepository } from '../../sheets/WorkTransactions/WorkTransactions.repository.js'
import type { ReadQueryDTO } from '../../shared/dtos/read-query.dto.js'
import { ApiError } from '../../shared/http/api-error.js'
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

export interface JobTicketAdvanceServiceOptions {
  repository?: () => JobTicketAdvanceRepository
  workTransactionRepository?: () => WorkTransactionAppender
  workTransactionReader?: () => { read(query?: ReadQueryDTO<Partial<WorkTransactionsDbRow>>): Promise<Array<Partial<WorkTransactionsDbRow>>> }
  deterministicEarnIds?: boolean
  now?: () => Date
}

export class JobTicketAdvanceService {
  private readonly repository: () => JobTicketAdvanceRepository
  private readonly workTransactionRepository: () => WorkTransactionAppender
  private readonly workTransactionReader
  private readonly deterministicEarnIds
  private readonly now: () => Date

  constructor(input: JobTicketAdvanceServiceOptions = {}) {
    this.repository = input.repository ?? getJobTicketsRepository
    this.workTransactionRepository = input.workTransactionRepository ?? getWorkTransactionsRepository
    this.workTransactionReader = input.workTransactionReader ?? getWorkTransactionsRepository
    this.deterministicEarnIds = input.deterministicEarnIds ?? false
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
    const orders = await this.readOrderTickets(repository, requested)
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
      const blocker = findEarlierDepartment(ticket, orderTickets)
      if (blocker !== undefined && blocker !== null) {
        blocked.push({ ticketId: entry.ticketId, laundryItemId: ticket.laundry_item_id ?? null, blockedByDepartment: blocker })
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
    const scoreFailed = await this.appendScores(completed, request.scannedBy)
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
      orders.set(orderId, (await repository.read({ where: { order_id: orderId } })).filter(live))
    }))
    return orders
  }

  private async appendScores(completed: Array<{ ticketId: string; workMinutes: JobTicketDbRow['work_minutes'] | undefined }>, actor: string): Promise<number> {
    const earnRows: Array<Partial<WorkTransactionsDbRow>> = []
    let scoreFailed = 0
    for (const ticket of completed) {
      if (typeof ticket.workMinutes !== 'number' || !Number.isFinite(ticket.workMinutes)) continue
      earnRows.push({
        id: this.deterministicEarnIds ? `EARN-${ticket.ticketId}` : generateShortId(), job_ticket_id: ticket.ticketId, type: 'EARN',
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

  async completePackaging(payload: unknown): Promise<void> {
    const request = parseOrThrow(jobTicketAdvanceRequestSchema, payload)
    if (request.department !== 'Packaging' || request.fromStatus !== 'In Progress') throw ApiError.validation('Expected Packaging completion')

    const orders = new Map(await Promise.all([...new Set(request.tickets.map(entry => entry.orderId))].map(async orderId => [
      orderId, await this.repository().read({ where: { order_id: orderId } }),
    ] as const)))
    const pending: typeof request.tickets = []
    const inProgress: typeof request.tickets = []
    const completed: Array<Partial<JobTicketDbRow>> = []
    for (const entry of request.tickets) {
      const ticket = orders.get(entry.orderId)?.find(row => row.id === entry.ticketId && !row.deleted_at && row.department === 'Packaging' && row.scope === 'ITEM')
      if (!ticket) throw ApiError.conflict('Packaging ticket is no longer available. Reload the order.')
      if (ticket.status === 'Completed') completed.push(ticket)
      else if (ticket.status === 'Pending') { pending.push(entry); inProgress.push(entry) }
      else if (ticket.status === 'In Progress') inProgress.push(entry)
      else throw ApiError.conflict('Packaging ticket cannot be completed. Reload the order.')
    }
    const scored = completed.filter(ticket => typeof ticket.work_minutes === 'number' && Number.isFinite(ticket.work_minutes))
    if (scored.length) {
      const scores = await this.workTransactionReader().read()
      const earned = new Set(scores.filter(row => row.type === 'EARN').map(row => row.job_ticket_id))
      const byActor = new Map<string, Array<{ ticketId: string; workMinutes: JobTicketDbRow['work_minutes'] | undefined }>>()
      for (const ticket of scored) {
        if (earned.has(ticket.id)) continue
        const actor = ticket.scanned_by || request.scannedBy
        const rows = byActor.get(actor) ?? []
        rows.push({ ticketId: ticket.id!, workMinutes: ticket.work_minutes })
        byActor.set(actor, rows)
      }
      for (const [actor, rows] of byActor) {
        if (await this.appendScores(rows, actor)) throw ApiError.internal('Packaging score was not saved. Press Confirm again.')
      }
    }
    for (const [fromStatus, tickets] of [['Pending', pending], ['In Progress', inProgress]] as const) {
      if (!tickets.length) continue
      const result = await this.advance({ ...request, fromStatus, tickets })
      if (result.kind !== 'completed' || result.blocked.length || result.skipped.length || result.scoreFailed) {
        throw ApiError.internal('Packaging work was not fully saved. Press Confirm again.')
      }
    }
  }
}
