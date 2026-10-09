import type { z } from 'zod'
import { bagItemListQuerySchema, bagItemResponseSchema } from '@contracts/bag-items/bag-item-api.schema'
import { apiGetList, type ListResult } from '@/shared/api/api-client'

export type BagItemDto = z.infer<typeof bagItemResponseSchema>

export function listBagItems(orderId: string, page = 1): Promise<ListResult<BagItemDto>> {
  return apiGetList('/api/bag-items', { query: { orderId, page }, querySchema: bagItemListQuerySchema })
}
