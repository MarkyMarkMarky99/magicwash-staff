import type { z } from 'zod'
import { jobTicketReopenRequestSchema, jobTicketReopenResponseSchema } from '../../../contracts/job-tickets/job-ticket-api.schema.js'
import type { jobTicketsRowSchema } from '../../sheets/JobTickets/JobTickets.db-contract.js'
import type { workTransactionsRowSchema } from '../../sheets/WorkTransactions/WorkTransactions.db-contract.js'
import { getJobTicketsRepository } from '../../sheets/JobTickets/JobTickets.repository.js'
import { getWorkTransactionsRepository } from '../../sheets/WorkTransactions/WorkTransactions.repository.js'
import type { SheetRepositoryContract, SheetBatchUpdateContract } from '../../shared/repositories/sheet-repository.contract.js'
import { WriteCommittedUnreadableError } from '../../shared/repositories/sheets-api.client.js'
import { classifySheetWriteFailure } from '../../shared/repositories/write-failure.js'
import { ApiError } from '../../shared/http/api-error.js'
import { parseOrThrow } from '../../shared/http/validate.js'
import { formatBangkokTimestamp } from '../../shared/utils/bangkok-timestamp.js'
import { generateShortId } from '../../shared/utils/id.js'

type Ticket = z.infer<typeof jobTicketsRowSchema>
type Transaction = z.infer<typeof workTransactionsRowSchema>
export type JobTicketReopenResponse = z.infer<typeof jobTicketReopenResponseSchema>

interface ReopenOptions {
  repository?: () => Pick<SheetRepositoryContract<Ticket>, 'read'> & SheetBatchUpdateContract<Ticket>
  workTransactionRepository?: () => Pick<SheetRepositoryContract<Transaction>, 'read' | 'batchAppend'>
  now?: () => Date
}

export class JobTicketReopenService {
  constructor(private readonly options: ReopenOptions = {}) {}

  async reopen(payload: unknown, actor: string): Promise<JobTicketReopenResponse> {
    const request = parseOrThrow(jobTicketReopenRequestSchema, payload)
    if (actor === 'AI' && request.department !== 'Washing' && request.department !== 'Ironing') {
      throw ApiError.forbidden('AI may only reopen Washing and Ironing tickets')
    }
    const repository = (this.options.repository ?? getJobTicketsRepository)()
    const ledger = (this.options.workTransactionRepository ?? getWorkTransactionsRepository)()
    const tickets = (await repository.read({ where: { order_id: request.orderId } }))
      .filter(ticket => String(ticket.order_id ?? '') === request.orderId && !ticket.deleted_at)
    const transactions = await ledger.read()
    const results: JobTicketReopenResponse['results'] = []
    const voidsWritten: JobTicketReopenResponse['voidsWritten'] = []
    const timestamp = formatBangkokTimestamp((this.options.now ?? (() => new Date()))())

    for (const ticketId of new Set(request.ticketIds)) {
      const ticket = tickets.find(row => row.id === ticketId && row.department === request.department)
      if (!ticket) {
        results.push({ ticketId, outcome: 'skipped', reason: 'not_found' })
        continue
      }
      const alreadyReopened = ticket.status === 'Pending'
        && /^reopen \d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2} [^\r\n]+: [^\r\n]+$/.test((ticket.notes ?? '').trimEnd().split(/\r?\n/).at(-1) ?? '')
      if (ticket.status !== 'Completed' && !alreadyReopened) {
        results.push({ ticketId, outcome: 'skipped', reason: 'status_changed' })
        continue
      }
      const blocker = !alreadyReopened && ticket.laundry_item_id ? tickets
        .filter(row => row.laundry_item_id === ticket.laundry_item_id && row.step_no! > ticket.step_no!
          && (row.status === 'In Progress' || row.status === 'Completed'))
        .sort((a, b) => a.step_no! - b.step_no!)[0] : undefined
      if (blocker) {
        results.push({ ticketId, outcome: 'blocked', reason: 'later_step', blockedByDepartment: blocker.department })
        continue
      }
      const ticketTransactions = transactions.filter(row => row.job_ticket_id === ticketId)
      const earns = ticketTransactions.filter(row => row.type === 'EARN')
      const reversed = new Set<string>()
      let legacyVoid = false
      for (const row of ticketTransactions.filter(row => row.type === 'VOID')) {
        const earnId = /^earn:([^\s]+)/.exec(row.notes ?? '')?.[1]
        if (!earnId || !earns.some(earn => earn.id === earnId)) legacyVoid = true
        else reversed.add(earnId)
      }
      if (legacyVoid) {
        results.push({ ticketId, outcome: 'blocked', reason: 'legacy_void' })
        continue
      }
      // Reconcile the append-only score ledger before changing ticket state. A retry reads it again.
      try {
        for (const earn of earns) {
          if (reversed.has(earn.id!)) continue
          const id = generateShortId()
          const written = { id, ticketId, earnId: earn.id! }
          try {
            await ledger.batchAppend([{ id, job_ticket_id: ticketId, type: 'VOID', minutes: -earn.minutes!,
              created_by: actor, notes: `earn:${earn.id} reopen: ${request.reason}` }])
          } catch (error) {
            if (error instanceof WriteCommittedUnreadableError) voidsWritten.push(written)
            throw error
          }
          voidsWritten.push(written)
          reversed.add(earn.id!)
        }
        if (!alreadyReopened) {
          await repository.updateMany([{ keyValue: ticketId, patch: {
            status: 'Pending', started_at: null, started_by: null, completed_at: null, scanned_by: null,
            updated_by: actor,
            notes: `${ticket.notes ? `${ticket.notes.trimEnd()}\n` : ''}reopen ${timestamp} ${actor}: ${request.reason}`,
          } }])
        }
      } catch (error) {
        return { kind: 'write_failed', certainty: classifySheetWriteFailure(error).certainty, results, voidsWritten }
      }
      results.push({ ticketId, outcome: alreadyReopened ? 'already_reopened' : 'reopened' })
    }
    return { kind: 'completed', results, voidsWritten }
  }
}
