import type { z } from 'zod'
import { jobTicketDepartmentWorkQuerySchema, jobTicketResponseSchema } from '../../../contracts/job-tickets/job-ticket-api.schema.js'
import { bangkokToday, normalizeSheetDate } from '../../../shared/utils/bangkok-datetime.js'
import type { jobTicketsRowSchema } from '../../sheets/JobTickets/JobTickets.db-contract.js'
import { getJobTicketsRepository } from '../../sheets/JobTickets/JobTickets.repository.js'
import { parseOrThrow } from '../../shared/http/validate.js'
import { Mapper } from '../../shared/repositories/base.repository.js'
import type { SheetRepositoryContract } from '../../shared/repositories/sheet-repository.contract.js'
import { mapDbRowToApi } from '../../shared/services/base-crud.service.js'
import { jobTicketFieldMap } from './job-ticket.field-map.js'

type JobTicketDbRow = z.infer<typeof jobTicketsRowSchema>
type JobTicketResponse = z.infer<typeof jobTicketResponseSchema>

export function selectDepartmentWork(rows: ReadonlyArray<Partial<JobTicketDbRow>>, today: string): Array<Partial<JobTicketDbRow>> {
  const liveRows = rows.filter(row => row.deleted_at == null || row.deleted_at === '')
  const keptOrders = new Set<string>()
  for (const row of liveRows) {
    const completedDate = normalizeSheetDate(row.completed_at)
    if (row.status === 'Pending' || row.status === 'In Progress'
      || (row.status === 'Completed' && completedDate !== null && completedDate >= today)) {
      keptOrders.add(String(row.order_id ?? ''))
    }
  }
  return liveRows.filter(row => row.status !== 'Cancelled' && keptOrders.has(String(row.order_id ?? '')))
}

export class JobTicketDepartmentWorkService {
  private readonly repository: () => Pick<SheetRepositoryContract<JobTicketDbRow>, 'readRaw' | 'queryBuilder'>
  private readonly now: () => Date

  constructor(options: {
    repository?: () => Pick<SheetRepositoryContract<JobTicketDbRow>, 'readRaw' | 'queryBuilder'>
    now?: () => Date
  } = {}) {
    this.repository = options.repository ?? getJobTicketsRepository
    this.now = options.now ?? (() => new Date())
  }

  async list(query: unknown): Promise<JobTicketResponse[]> {
    const { department } = parseOrThrow(jobTicketDepartmentWorkQuerySchema, query)
    const repository = this.repository()
    const q = repository.queryBuilder()
    const rows = await repository.readRaw(`select * where ${q.col('department')} = ${q.lit('department', department)}`)
    const mapper = new Mapper(jobTicketFieldMap)
    return selectDepartmentWork(rows, bangkokToday(this.now())).map(row => {
      const source = mapDbRowToApi(row, mapper, {})
      const output: Record<string, unknown> = {}
      for (const field of Object.keys(jobTicketResponseSchema.shape)) output[field] = source[field]
      return output as JobTicketResponse
    })
  }
}
