import type { z } from 'zod'
import { laundryItemResponseSchema } from '@contracts/laundry-items/laundry-item-api.schema'
import { laundryItemRegisterRequestSchema, laundryItemRegisterResponseSchema } from '@contracts/laundry-items/laundry-item-register-api.schema'
import { ApiError, apiGet, apiPost } from '@/shared/api/api-client'
import { invalidate } from '@/shared/api/response-cache'

export type LaundryItemDto = z.infer<typeof laundryItemResponseSchema>

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
