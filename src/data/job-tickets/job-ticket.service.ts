import { z } from 'zod'
import { jobTicketListQuerySchema, jobTicketResponseSchema, jobTicketScanRequestSchema, jobTicketScanResponseSchema } from '@contracts/job-tickets/job-ticket-api.schema'
import { apiGetList, apiPost, type ListResult } from '@/shared/api/api-client'
import { normalizeSheetDate, todaySheetDate } from '@/shared/utils/sheet-date'
import { normalizeGarmentTagId } from '@/shared/utils/garment-tag-id'

export type JobTicketDto = Omit<z.infer<typeof jobTicketResponseSchema>, 'laundryItemId'> & { laundryItemId: string | null }
export type JobTicketListQuery = z.infer<typeof jobTicketListQuerySchema>
export type JobTicketScanPayload = z.infer<typeof jobTicketScanRequestSchema>
export type JobTicketScanResult = z.infer<typeof jobTicketScanResponseSchema>

const ENDPOINT = '/api/job-tickets'
const PAGE_SIZE = 500
export const MAX_DEPARTMENT_TICKETS = 2000

export async function listJobTickets(query: Partial<JobTicketListQuery>): Promise<ListResult<JobTicketDto>> {
  const result = await apiGetList<z.infer<typeof jobTicketResponseSchema>>(ENDPOINT, { query, querySchema: jobTicketListQuerySchema })
  return { ...result, items: result.items.map(ticket => ({ ...ticket, laundryItemId: normalizeGarmentTagId(ticket.laundryItemId) })) }
}

const scanResponseSchema = z.preprocess(value => {
  if (value && typeof value === 'object' && 'laundryItemId' in value) {
    return { ...value, laundryItemId: normalizeGarmentTagId(value.laundryItemId) }
  }
  return value
}, jobTicketScanResponseSchema)

export function scanJobTicket(payload: JobTicketScanPayload): Promise<JobTicketScanResult> {
  return apiPost<JobTicketScanResult>(`${ENDPOINT}/scan`, {
    data: payload,
    requestSchema: jobTicketScanRequestSchema,
    responseSchema: scanResponseSchema as z.ZodType<JobTicketScanResult>,
    acceptedStatuses: [404, 409, 500, 502],
  })
}

export function completedTodayFromPage(tickets: readonly JobTicketDto[], today: string): { tickets: JobTicketDto[]; reachedOlder: boolean } {
  const firstOlder = tickets.findIndex(ticket => {
    const date = normalizeSheetDate(ticket.completedAt)
    return date !== null && date < today
  })
  const current = (firstOlder === -1 ? tickets : tickets.slice(0, firstOlder))
    .filter(ticket => {
      const date = normalizeSheetDate(ticket.completedAt)
      return date !== null && date >= today
    })
  return { tickets: current, reachedOlder: firstOlder !== -1 }
}

export async function loadDepartmentTickets(
  department: JobTicketListQuery['department'],
  now: Date = new Date(),
  fetchPage: typeof listJobTickets = listJobTickets,
): Promise<{ tickets: JobTicketDto[]; truncated: boolean }> {
  const tickets: JobTicketDto[] = []
  const today = todaySheetDate(now)
  for (const status of ['Pending', 'In Progress', 'Completed'] as const) {
    let page = 1
    while (tickets.length < MAX_DEPARTMENT_TICKETS) {
      const perPage = Math.min(PAGE_SIZE, MAX_DEPARTMENT_TICKETS - tickets.length)
      const result = await fetchPage({ department, status, page, perPage,
        sortBy: status === 'Completed' ? 'completedAt' : 'createdAt', sortOrder: 'desc' })
      const selected = status === 'Completed' ? completedTodayFromPage(result.items, today) : { tickets: result.items, reachedOlder: false }
      tickets.push(...selected.tickets.slice(0, MAX_DEPARTMENT_TICKETS - tickets.length))
      if (selected.reachedOlder || result.items.length < perPage) break
      page += 1
    }
    if (tickets.length >= MAX_DEPARTMENT_TICKETS) return { tickets, truncated: true }
  }
  return { tickets, truncated: false }
}
