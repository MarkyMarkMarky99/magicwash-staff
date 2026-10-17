import { z } from 'zod'
import { jobTicketCompleteOrderRequestSchema, jobTicketCompleteOrderResponseSchema, jobTicketAdvanceRequestSchema, jobTicketAdvanceResponseSchema, jobTicketDepartmentWorkQuerySchema, jobTicketListQuerySchema, jobTicketResponseSchema, jobTicketStartOrderRequestSchema, jobTicketStartOrderResponseSchema } from '@contracts/job-tickets/job-ticket-api.schema'
import { apiGet, apiGetList, apiPost, type ListResult } from '@/shared/api/api-client'
import { normalizeGarmentTagId } from '@/shared/utils/garment-tag-id'

export type JobTicketDto = Omit<z.infer<typeof jobTicketResponseSchema>, 'laundryItemId'> & { laundryItemId: string | null }
export type JobTicketListQuery = z.infer<typeof jobTicketListQuerySchema>
export type JobTicketStartOrderPayload = z.infer<typeof jobTicketStartOrderRequestSchema>
export type JobTicketStartOrderResult = z.infer<typeof jobTicketStartOrderResponseSchema>
export type JobTicketCompleteOrderPayload = z.infer<typeof jobTicketCompleteOrderRequestSchema>
export type JobTicketCompleteOrderResult = z.infer<typeof jobTicketCompleteOrderResponseSchema>
export type JobTicketAdvancePayload = z.infer<typeof jobTicketAdvanceRequestSchema>
export type JobTicketAdvanceResult = z.infer<typeof jobTicketAdvanceResponseSchema>

const ENDPOINT = '/api/job-tickets'
export const MAX_DEPARTMENT_TICKETS = 10_000

export async function listJobTickets(query: Partial<JobTicketListQuery>): Promise<ListResult<JobTicketDto>> {
  const result = await apiGetList<z.infer<typeof jobTicketResponseSchema>>(ENDPOINT, { query, querySchema: jobTicketListQuerySchema })
  return { ...result, items: result.items.map(ticket => ({ ...ticket, laundryItemId: normalizeGarmentTagId(ticket.laundryItemId) })) }
}

export function completeJobTicketOrder(payload: JobTicketCompleteOrderPayload): Promise<JobTicketCompleteOrderResult> {
  return apiPost<JobTicketCompleteOrderResult>(`${ENDPOINT}/complete-order`, {
    data: payload,
    requestSchema: jobTicketCompleteOrderRequestSchema,
    responseSchema: jobTicketCompleteOrderResponseSchema,
    acceptedStatuses: [500, 502],
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

export async function loadDepartmentWork(department: JobTicketListQuery['department'] & string): Promise<JobTicketDto[]> {
  jobTicketDepartmentWorkQuerySchema.parse({ department })
  const tickets = await apiGet<z.infer<typeof jobTicketResponseSchema>[]>(`${ENDPOINT}/department-work?department=${encodeURIComponent(department)}`)
  return tickets.map(ticket => ({ ...ticket, laundryItemId: normalizeGarmentTagId(ticket.laundryItemId) }))
}
