import type { z } from 'zod'
import {
  priceListListQuerySchema,
  priceListListResponseSchema,
} from '@contracts/price-list/price-list-api.schema'
import { apiGetList } from '@/shared/api/api-client'

export type InvoicePriceListItemDto = z.infer<typeof priceListListResponseSchema>

const PRICE_LIST_ENDPOINT = '/api/price-list'

export interface InvoicePriceListFetchResult {
  items: InvoicePriceListItemDto[]
  truncated: boolean
}

export async function fetchAllInvoicePriceListItems(): Promise<InvoicePriceListFetchResult> {
  const { items } = await apiGetList<InvoicePriceListItemDto>(PRICE_LIST_ENDPOINT, {
    query: {
      perPage: 1000,
      priceGroup: 'DEFAULT',
      sortBy: 'itemCode',
      sortOrder: 'asc',
    },
    querySchema: priceListListQuerySchema,
  })

  return { items, truncated: items.length === 1000 }
}
