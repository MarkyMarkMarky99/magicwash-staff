import type { z } from 'zod'
import {
  priceListListQuerySchema,
  type priceListListResponseSchema,
} from '@contracts/price-list/price-list-api.schema'
import { apiGetList } from '@/shared/api/api-client'

export type OrderPriceListItemDto = z.infer<typeof priceListListResponseSchema>
export type OrderPriceListServiceType = OrderPriceListItemDto['serviceType']

const PRICE_LIST_ENDPOINT = '/api/price-list'

export interface OrderPriceListFetchResult {
  items: OrderPriceListItemDto[]
  /** The catalogue may contain additional rows when this is true. */
  truncated: boolean
}

export async function fetchOrderPriceList(
  serviceType: OrderPriceListServiceType,
): Promise<OrderPriceListFetchResult> {
  const { items } = await apiGetList<OrderPriceListItemDto>(PRICE_LIST_ENDPOINT, {
    query: {
      perPage: 1000,
      priceGroup: 'DEFAULT',
      serviceType,
      sortBy: 'itemCode',
      sortOrder: 'asc',
    },
    querySchema: priceListListQuerySchema,
  })

  return { items, truncated: items.length === 1000 }
}
