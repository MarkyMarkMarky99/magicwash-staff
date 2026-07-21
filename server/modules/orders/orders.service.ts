import type { z } from 'zod'
import { orderListQuerySchema, orderListResponseSchema } from '../../../contracts/orders/order-api.schema'
import { parseOrThrow } from '../../shared/http/validate'
import { requireEnv } from '../../shared/utils/env'
import { mapOrderRow, type OrderApiRow } from './orders.mapper'
import { OrdersRepository } from './orders.repository'

export type OrderListResponse = z.infer<typeof orderListResponseSchema>

export interface OrdersListResult {
  items: OrderListResponse[]
  pagination: {
    page: number
    perPage: number
  }
}

export class OrdersService {
  constructor(private readonly repository: OrdersRepository) {}

  async list(query: unknown): Promise<OrdersListResult> {
    const validQuery = parseOrThrow(orderListQuerySchema, query)
    const rows = await this.repository.read(validQuery)

    return {
      items: rows.map((row) => this.project(mapOrderRow(row))),
      pagination: {
        page: validQuery.page,
        perPage: validQuery.perPage,
      },
    }
  }

  private project(row: OrderApiRow): OrderListResponse {
    const source: Record<string, unknown> = Object.fromEntries(Object.entries(row))
    const output: Record<string, unknown> = {}

    for (const field of Object.keys(orderListResponseSchema.shape)) {
      output[field] = source[field]
    }

    return output as OrderListResponse
  }
}

const ordersRepository = new OrdersRepository(requireEnv('ORDERS_SPREADSHEET_ID'))

export const ordersService = new OrdersService(ordersRepository)
