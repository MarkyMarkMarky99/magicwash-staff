import type { z } from 'zod'
import { orderListQuerySchema } from '../../../contracts/orders/order-api.schema'
import { deriveGVizColumns, GVizQueryBuilder } from '../../shared/repositories/utils/gviz-query.builder'
import { fetchGVizRows } from '../../shared/repositories/utils/gviz-reader'
import type { OrderRow } from './order.contract'
import { orderRowSchema } from './order.contract'

type OrderListQuery = z.infer<typeof orderListQuerySchema>

const ORDERS_SHEET_NAME = 'OrdersView'

export class OrdersRepository {
  private readonly columns = deriveGVizColumns(orderRowSchema)

  constructor(private readonly spreadsheetId: string) {}

  async read(query: OrderListQuery): Promise<Partial<OrderRow>[]> {
    const gvizQuery = GVizQueryBuilder.fromColumns(this.columns)
      .fromQuery({
        where: { customerId: query.customerId },
        sort: { field: query.sortBy, order: query.sortOrder },
        pagination: { page: query.page, perPage: query.perPage },
      })
      .build()

    return fetchGVizRows<Partial<OrderRow>>({
      spreadsheetId: this.spreadsheetId,
      sheetName: ORDERS_SHEET_NAME,
      query: gvizQuery,
      columns: this.columns,
    })
  }
}
