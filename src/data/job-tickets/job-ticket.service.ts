import { z } from 'zod'
import { jobTicketListQuerySchema, jobTicketResponseSchema, jobTicketScanRequestSchema, jobTicketScanResponseSchema, jobTicketStartOrderRequestSchema, jobTicketStartOrderResponseSchema } from '@contracts/job-tickets/job-ticket-api.schema'
import { apiGetList, apiPost, type ListResult } from '@/shared/api/api-client'
import { normalizeSheetDate, todaySheetDate } from '@/shared/utils/sheet-date'
import { normalizeGarmentTagId } from '@/shared/utils/garment-tag-id'

export type JobTicketDto = Omit<z.infer<typeof jobTicketResponseSchema>, 'laundryItemId'> & { laundryItemId: string | null }
export type JobTicketListQuery = z.infer<typeof jobTicketListQuerySchema>
export type JobTicketScanPayload = z.infer<typeof jobTicketScanRequestSchema>
export type JobTicketScanResult = z.infer<typeof jobTicketScanResponseSchema>
export type JobTicketStartOrderPayload = z.infer<typeof jobTicketStartOrderRequestSchema>
export type JobTicketStartOrderResult = z.infer<typeof jobTicketStartOrderResponseSchema>

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

const startOrderResponseSchema = z.preprocess(value => {
  if (!value || typeof value !== 'object') return value
  const response = value as Record<string, unknown>
  const normalizeEntry = (entry: unknown) => entry && typeof entry === 'object' && 'laundryItemId' in entry
    ? { ...entry, laundryItemId: normalizeGarmentTagId(entry.laundryItemId) } : entry
  return {
    ...response,
    ...(Array.isArray(response.advanced) ? { advanced: response.advanced.map(normalizeEntry) } : {}),
    ...(Array.isArray(response.blocked) ? { blocked: response.blocked.map(normalizeEntry) } : {}),
  }
}, jobTicketStartOrderResponseSchema)

export function startJobTicketOrder(payload: JobTicketStartOrderPayload): Promise<JobTicketStartOrderResult> {
  return apiPost<JobTicketStartOrderResult>(`${ENDPOINT}/start-order`, {
    data: payload,
    requestSchema: jobTicketStartOrderRequestSchema,
    responseSchema: startOrderResponseSchema as z.ZodType<JobTicketStartOrderResult>,
    acceptedStatuses: [500, 502],
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
  const today = todaySheetDate(now)
  const statuses = ['Pending', 'In Progress', 'Completed'] as const
  const results = await Promise.all(statuses.map(async status => {
    const tickets: JobTicketDto[] = []
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
    return tickets
  }))
  const combined = results.flat()
  return { tickets: combined.slice(0, MAX_DEPARTMENT_TICKETS), truncated: combined.length >= MAX_DEPARTMENT_TICKETS }
}
