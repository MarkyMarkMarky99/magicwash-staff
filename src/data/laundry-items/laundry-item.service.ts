import type { z } from 'zod'
import { laundryItemListQuerySchema, laundryItemResponseSchema, laundryItemUpdateSchema } from '@contracts/laundry-items/laundry-item-api.schema'
import { laundryItemRegisterRequestSchema, laundryItemRegisterResponseSchema } from '@contracts/laundry-items/laundry-item-register-api.schema'
import { ApiError, apiGet, apiGetList, apiPatch, apiPost } from '@/shared/api/api-client'
import { currentActor } from '@/shared/config/actor'
import { invalidate } from '@/shared/api/response-cache'

export type LaundryItemDto = z.infer<typeof laundryItemResponseSchema>

export async function updateLaundryItem(id: string, payload: Omit<z.input<typeof laundryItemUpdateSchema>, 'updatedBy'>): Promise<LaundryItemDto> {
  const result = laundryItemResponseSchema.parse(await apiPatch<unknown>(`/api/laundry-items/${encodeURIComponent(id)}`, {
    data: { ...payload, updatedBy: currentActor() }, requestSchema: laundryItemUpdateSchema,
  }))
  invalidate('/api/laundry-items')
  return result
}

export async function registerLaundryItems(payload: z.input<typeof laundryItemRegisterRequestSchema>) {
  const response = laundryItemRegisterResponseSchema.parse(await apiPost<unknown>('/api/laundry-items/register', {
    data: payload,
    requestSchema: laundryItemRegisterRequestSchema,
  }))
  invalidate('/api/laundry-items')
  return response
}

export async function getLaundryItem(tag: string): Promise<LaundryItemDto | null> {
  const path = `/api/laundry-items/${encodeURIComponent(tag)}`
  invalidate(path)
  try {
    return laundryItemResponseSchema.parse(await apiGet<unknown>(path))
  } catch (reason) {
    if (reason instanceof ApiError && reason.status === 404) return null
    throw reason
  }
}

/** A customer's registered garments, fresh from the server. Rows that fail the schema are left out. */
export async function listCustomerLaundryItems(customerId: string): Promise<LaundryItemDto[]> {
  invalidate('/api/laundry-items')
  const { items } = await apiGetList<unknown>('/api/laundry-items', {
    querySchema: laundryItemListQuerySchema,
    query: { customerId, perPage: 1000 },
  })
  return items.flatMap((item) => {
    const parsed = laundryItemResponseSchema.safeParse(item)
    return parsed.success && parsed.data.deletedAt === null ? [parsed.data] : []
  })
}
