import type { z } from 'zod'
import {
  workTransactionListQuerySchema,
  workTransactionTypeSchema,
  type workTransactionSchema,
} from '../../../contracts/work-transactions/work-transaction-api.schema.js'
import { normalizeSheetTimestamp, toNumber, toRequiredString } from '../../../shared/utils/bangkok-datetime.js'
import { workTransactionsRowSchema } from '../../sheets/WorkTransactions/WorkTransactions.db-contract.js'
import { getWorkTransactionsRepository } from '../../sheets/WorkTransactions/WorkTransactions.repository.js'
import { parseOrThrow } from '../../shared/http/validate.js'
import { departmentForJobTicketId } from '../work-orders/job-ticket-provisioning.js'

type WorkTransactionsDbRow = z.infer<typeof workTransactionsRowSchema>
type WorkTransactionDto = z.infer<typeof workTransactionSchema>

export interface WorkTransactionReader {
  read(): Promise<Array<Partial<WorkTransactionsDbRow>>>
}

export class WorkTransactionService {
  constructor(private readonly repository: () => WorkTransactionReader = getWorkTransactionsRepository) {}

  async list(query: unknown): Promise<WorkTransactionDto[]> {
    const { from, to } = parseOrThrow(workTransactionListQuerySchema, query)
    const rows = await this.repository().read()

    const earnerByTicket = new Map<string, string>()
    for (const row of rows) {
      const ticketId = toRequiredString(row.job_ticket_id)
      if (row.type === 'EARN' && ticketId !== '' && !earnerByTicket.has(ticketId)) {
        earnerByTicket.set(ticketId, toRequiredString(row.created_by))
      }
    }

    const items: WorkTransactionDto[] = []
    for (const row of rows) {
      const type = workTransactionTypeSchema.safeParse(row.type)
      const jobTicketId = toRequiredString(row.job_ticket_id)
      const createdAt = normalizeSheetTimestamp(row.created_at)
      const day = createdAt.slice(0, 10)
      if (!type.success || jobTicketId === '' || day < from || day > to) continue
      const createdBy = toRequiredString(row.created_by)
      items.push({
        id: toRequiredString(row.id),
        jobTicketId,
        department: departmentForJobTicketId(jobTicketId),
        type: type.data,
        minutes: toNumber(row.minutes),
        staffId: type.data === 'EARN' ? createdBy : earnerByTicket.get(jobTicketId) ?? createdBy,
        createdAt,
        createdBy,
      })
    }
    return items
  }
}
