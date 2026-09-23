import type { z } from 'zod'
import { itemsCreateSchema, itemsListQuerySchema, itemsResponseSchema } from '@contracts/items/items-api.schema'
import { apiGetList, apiPost } from '@/shared/api/api-client'
import { uploadToStorage } from '@/shared/api/firebase-storage'
import { invalidate } from '@/shared/api/response-cache'

export type ItemDto = z.infer<typeof itemsResponseSchema>
export type ItemCreatePayload = z.input<typeof itemsCreateSchema>
export interface ItemsResult { items: ItemDto[]; truncated: boolean }

export async function listItems(onFresh?: (result: ItemsResult) => void): Promise<ItemsResult> {
  const { items } = await apiGetList<ItemDto>('/api/items', {
    query: { perPage: 1000 }, querySchema: itemsListQuerySchema,
    onFresh: (result) => onFresh?.({ items: result.items, truncated: result.items.length === 1000 }),
  })
  return { items, truncated: items.length === 1000 }
}

export async function uploadItemPhoto(file: File): Promise<string> {
  return uploadToStorage(file, `items/${crypto.randomUUID()}`)
}

export async function createItem(payload: ItemCreatePayload): Promise<ItemDto> {
  const item = await apiPost<ItemDto>('/api/items', { data: payload, requestSchema: itemsCreateSchema })
  invalidate('/api/items')
  return item
}
