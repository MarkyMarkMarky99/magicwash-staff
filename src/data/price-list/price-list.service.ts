import type { z } from 'zod'
import {
  priceListCreateSchema,
  priceListListQuerySchema,
  priceListListResponseSchema,
  priceListUpdateSchema,
} from '@contracts/price-list/price-list-api.schema'
import { apiGetList, apiPatch, apiPost } from '@/shared/api/api-client'
import { invalidate } from '@/shared/api/response-cache'

export type PriceListDto = z.infer<typeof priceListListResponseSchema>
export type PriceListCreatePayload = z.infer<typeof priceListCreateSchema>
export type PriceListUpdatePayload = z.infer<typeof priceListUpdateSchema>

const PRICE_LIST_ENDPOINT = '/api/price-list'

export interface PriceListResult {
  items: PriceListDto[]
  truncated: boolean
}

function toPriceListResult(items: PriceListDto[]): PriceListResult {
  return { items, truncated: items.length === 1000 }
}

export async function listPriceList(
  onFresh?: (result: PriceListResult) => void,
): Promise<PriceListResult> {
  const { items } = await apiGetList<PriceListDto>(PRICE_LIST_ENDPOINT, {
    query: { perPage: 1000 },
    querySchema: priceListListQuerySchema,
    onFresh: (result) => onFresh?.(toPriceListResult(result.items)),
  })
  return toPriceListResult(items)
}

export async function createPriceList(payload: PriceListCreatePayload): Promise<PriceListDto> {
  const result = await apiPost<PriceListDto>(PRICE_LIST_ENDPOINT, {
    data: payload,
    requestSchema: priceListCreateSchema,
  })
  invalidate('/api/price-list')
  return result
}

export async function updatePriceList(
  id: string,
  payload: PriceListUpdatePayload,
): Promise<PriceListDto> {
  const result = await apiPatch<PriceListDto>(`${PRICE_LIST_ENDPOINT}/${encodeURIComponent(id)}`, {
    data: payload,
    requestSchema: priceListUpdateSchema,
  })
  invalidate('/api/price-list')
  return result
}
