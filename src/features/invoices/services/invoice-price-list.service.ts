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
  /** True when the response filled the request cap. */
  truncated: boolean
}

/**
 * Fetch the bounded price-list catalogue up front. Filtering by `active` is the
 * caller's job — this returns the raw rows.
 *
 */
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
