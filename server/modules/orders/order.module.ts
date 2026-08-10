import { z } from 'zod'
import { orderApiContract } from '../../../contracts/orders/order-api.schema.js'
import {
  BaseCrudService,
  type JsonColumnMap,
} from '../../shared/services/base-crud.service.js'
import type { ApiRowFromFieldMap } from '../../shared/repositories/base.repository.js'
import { createCrudRoutes } from '../../shared/http/crud-routes.js'
import { getOrdersViewRepository } from '../../sheets/OrdersView/OrdersView.repository.js'
import { ordersViewRowSchema } from '../../sheets/OrdersView/OrdersView.db-contract.js'

type OrdersViewDbRow = z.infer<typeof ordersViewRowSchema>

/** DB column -> API/domain field. JSON columns keep their storage name here;
 * `ordersViewJsonColumns` declares the decoded field they become below. */
export const ordersViewFieldMap = {
  order_id: 'orderId',
  customer_id: 'customerId',
  order_number: 'orderNumber',
  invoice_number: 'invoiceNumber',
  received_date: 'receivedDate',
  due_date: 'dueDate',
  service_type: 'serviceType',
  status: 'status',
  quantity: 'quantity',
  note: 'note',
  items_json: 'itemsJson',
  synced_at: 'syncedAt',
  created_at: 'createdAt',
} as const satisfies Record<keyof OrdersViewDbRow & string, string>

export const ordersViewJsonColumns = {
  items_json: { field: 'items', kind: 'array' },
} as const satisfies JsonColumnMap

type OrdersViewApiRow = ApiRowFromFieldMap<OrdersViewDbRow, typeof ordersViewFieldMap>
type OrdersListQuery = z.infer<typeof orderApiContract.query.list>
type OrdersListResponse = z.infer<typeof orderApiContract.response.list>

type OrdersService = BaseCrudService<
  OrdersViewApiRow,
  OrdersListQuery,
  never,
  never,
  OrdersListResponse,
  never,
  never,
  never,
  OrdersViewDbRow,
  typeof ordersViewFieldMap
>

// searchFields is []: this list has no keyword search.
export const ordersService: OrdersService = new BaseCrudService({
  repository: getOrdersViewRepository,
  api: orderApiContract,
  searchFields: [],
  fieldMap: ordersViewFieldMap,
  jsonColumns: ordersViewJsonColumns,
})

export const orderRoutes = createCrudRoutes(ordersService, orderApiContract)
