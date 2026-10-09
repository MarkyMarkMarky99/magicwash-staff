import { z } from 'zod'
import { jobTicketAdvanceRequestSchema, jobTicketAdvanceResponseSchema, jobTicketListQuerySchema, jobTicketResponseSchema, jobTicketStartOrderRequestSchema, jobTicketStartOrderResponseSchema } from '@contracts/job-tickets/job-ticket-api.schema'
import { apiGetList, apiPost, type ListResult } from '@/shared/api/api-client'
import { normalizeSheetDate, todaySheetDate } from '@/shared/utils/sheet-date'
import { normalizeGarmentTagId } from '@/shared/utils/garment-tag-id'

export type JobTicketDto = Omit<z.infer<typeof jobTicketResponseSchema>, 'laundryItemId'> & { laundryItemId: string | null }
export type JobTicketListQuery = z.infer<typeof jobTicketListQuerySchema>
export type JobTicketStartOrderPayload = z.infer<typeof jobTicketStartOrderRequestSchema>
export type JobTicketStartOrderResult = z.infer<typeof jobTicketStartOrderResponseSchema>
export type JobTicketAdvancePayload = z.infer<typeof jobTicketAdvanceRequestSchema>
export type JobTicketAdvanceResult = z.infer<typeof jobTicketAdvanceResponseSchema>

const ENDPOINT = '/api/job-tickets'
const PAGE_SIZE = 500
export const MAX_DEPARTMENT_TICKETS = 10_000

export async function listJobTickets(query: Partial<JobTicketListQuery>): Promise<ListResult<JobTicketDto>> {
  const result = await apiGetList<z.infer<typeof jobTicketResponseSchema>>(ENDPOINT, { query, querySchema: jobTicketListQuerySchema })
  return { ...result, items: result.items.map(ticket => ({ ...ticket, laundryItemId: normalizeGarmentTagId(ticket.laundryItemId) })) }
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

const advanceResponseSchema = z.preprocess(value => {
  if (!value || typeof value !== 'object') return value
  const response = value as Record<string, unknown>
  const normalizeEntry = (entry: unknown) => entry && typeof entry === 'object' && 'laundryItemId' in entry
    ? { ...entry, laundryItemId: normalizeGarmentTagId(entry.laundryItemId) } : entry
  return {
    ...response,
    ...(Array.isArray(response.advanced) ? { advanced: response.advanced.map(normalizeEntry) } : {}),
    ...(Array.isArray(response.blocked) ? { blocked: response.blocked.map(normalizeEntry) } : {}),
  }
}, jobTicketAdvanceResponseSchema)

export function advanceJobTickets(payload: JobTicketAdvancePayload): Promise<JobTicketAdvanceResult> {
  return apiPost<JobTicketAdvanceResult>(`${ENDPOINT}/advance`, {
    data: payload,
    requestSchema: jobTicketAdvanceRequestSchema,
    responseSchema: advanceResponseSchema as z.ZodType<JobTicketAdvanceResult>,
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

async function loadStatusTickets(
  status: 'Pending' | 'In Progress' | 'Completed',
  department: JobTicketListQuery['department'],
  today: string,
  fetchPage: typeof listJobTickets,
): Promise<JobTicketDto[]> {
  const tickets: JobTicketDto[] = []
  for (let page = 1; tickets.length < MAX_DEPARTMENT_TICKETS; page += 1) {
    // Open work is read in one request per status: each extra page costs a full JobTickets scan.
    const perPage = Math.min(status === 'Completed' ? PAGE_SIZE : MAX_DEPARTMENT_TICKETS, MAX_DEPARTMENT_TICKETS - tickets.length)
    const result = await fetchPage({ department, status, page, perPage,
      sortBy: status === 'Completed' ? 'completedAt' : 'createdAt', sortOrder: 'desc' })
    const selected = status === 'Completed' ? completedTodayFromPage(result.items, today) : { tickets: result.items, reachedOlder: false }
    tickets.push(...selected.tickets.slice(0, MAX_DEPARTMENT_TICKETS - tickets.length))
    if (selected.reachedOlder || result.items.length < perPage) break
  }
  return tickets
}

export async function loadOpenTickets(
  fetchPage: typeof listJobTickets = listJobTickets,
): Promise<{ tickets: JobTicketDto[]; truncated: boolean }> {
  const results = await Promise.all([
    loadStatusTickets('Pending', undefined, '', fetchPage),
    loadStatusTickets('In Progress', undefined, '', fetchPage),
  ])
  const combined = results.flat()
  return { tickets: combined.slice(0, MAX_DEPARTMENT_TICKETS), truncated: combined.length >= MAX_DEPARTMENT_TICKETS }
}

export async function loadCompletedTickets(
  department: JobTicketListQuery['department'],
  now: Date = new Date(),
  fetchPage: typeof listJobTickets = listJobTickets,
): Promise<{ tickets: JobTicketDto[]; truncated: boolean }> {
  const tickets = await loadStatusTickets('Completed', department, todaySheetDate(now), fetchPage)
  return { tickets, truncated: tickets.length >= MAX_DEPARTMENT_TICKETS }
}

// Current work for every department in one load: all open tickets plus those completed today.
export async function loadCurrentTickets(
  now: Date = new Date(),
  fetchPage: typeof listJobTickets = listJobTickets,
): Promise<{ tickets: JobTicketDto[]; truncated: boolean }> {
  const [open, completed] = await Promise.all([loadOpenTickets(fetchPage), loadCompletedTickets(undefined, now, fetchPage)])
  return { tickets: [...open.tickets, ...completed.tickets], truncated: open.truncated || completed.truncated }
}
