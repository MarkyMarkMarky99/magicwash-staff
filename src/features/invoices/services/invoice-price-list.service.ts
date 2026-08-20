import type { z } from 'zod'
import {
  priceListListQuerySchema,
  priceListListResponseSchema,
} from '@contracts/price-list/price-list-api.schema'
import { apiGetList } from '@/shared/api/api-client'

export type InvoicePriceListItemDto = z.infer<typeof priceListListResponseSchema>

const PRICE_LIST_ENDPOINT = '/api/price-list'

/** Contract max for `perPage` is 100 — walk every page at that size. */
const PAGE_SIZE = 100

/**
 * Hard stop so a backend that always returns a full page cannot loop forever.
 * 40 pages × 100 = 4,000 rows; the picker still display-caps at 2,000.
 */
const MAX_PAGES = 40

export interface InvoicePriceListFetchResult {
  items: InvoicePriceListItemDto[]
  /** True when we stopped because MAX_PAGES was hit with a still-full last page. */
  truncated: boolean
}

/**
 * Fetch every price-list page up front. The list endpoint only returns
 * `{ page, perPage }` (no `total` / `totalPages`), so we stop on a short page.
 *
 * Filtering by `active` is the caller's job — this returns the raw rows.
 */
export async function fetchAllInvoicePriceListItems(): Promise<InvoicePriceListFetchResult> {
  const items: InvoicePriceListItemDto[] = []

  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const { items: pageItems, pagination } = await apiGetList<InvoicePriceListItemDto>(
      PRICE_LIST_ENDPOINT,
      {
        query: {
          page,
          perPage: PAGE_SIZE,
          sortBy: 'itemCode',
          sortOrder: 'asc',
        },
        querySchema: priceListListQuerySchema,
      },
    )

    items.push(...pageItems)

    const perPage = pagination.perPage > 0 ? pagination.perPage : PAGE_SIZE
    if (pageItems.length < perPage) {
      return { items, truncated: false }
    }
  }

  return { items, truncated: true }
}
