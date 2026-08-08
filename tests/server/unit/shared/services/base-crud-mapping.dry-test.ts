import assert from 'node:assert/strict'
import { z } from 'zod'
import { orderApiContract } from '../../../../../contracts/orders/order-api.schema.js'
import type { ApiRowFromFieldMap } from '../../../../../server/shared/repositories/base.repository.js'
import { SheetRepository } from '../../../../../server/shared/repositories/sheet.repository.js'
import { ReadQueryDTO } from '../../../../../server/shared/dtos/read-query.dto.js'
import { BaseCrudService } from '../../../../../server/shared/services/base-crud.service.js'
import {
  ordersViewDbContract,
  ordersViewRowSchema,
} from '../../../../../server/sheets/OrdersView/OrdersView.db-contract.js'
import {
  ordersViewFieldMap,
  ordersViewJsonColumns,
} from '../../../../../server/modules/orders/order.module.js'

type OrdersDbRow = z.infer<typeof ordersViewRowSchema>
type OrdersApiRow = ApiRowFromFieldMap<OrdersDbRow, typeof ordersViewFieldMap>
type OrdersListQuery = z.infer<typeof orderApiContract.query.list>
type OrdersListResponse = z.infer<typeof orderApiContract.response.list>

// OrdersView is list-only in production. This local contract adds the same
// response as a detail slot so the migrated BaseCrudService read-by-id path can
// be characterized here without changing the public production contract.
const mappingApiContract = {
  query: orderApiContract.query,
  response: {
    list: orderApiContract.response.list,
    detail: orderApiContract.response.list,
  },
}

interface FetchCall {
  url: string
}

function response(text: string): Response {
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    text: async () => text,
  } as Response
}

function gvizBody(): string {
  return `google.visualization.Query.setResponse(${JSON.stringify({
    status: 'ok',
    table: {
      cols: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M'].map(
        (id) => ({ id }),
      ),
      rows: [
        {
          c: [
            { v: 'order-1' },
            { v: 'customer-1' },
            { v: '1001' },
            null,
            { v: '2026-08-08' },
            { v: '2026-08-10' },
            { v: 'WASH' },
            { v: 'CONFIRMED' },
            { v: 3 },
            { v: 'Call before delivery' },
            {
              v: JSON.stringify([
                {
                  id: 'item-1',
                  description: 'Shirt',
                  service_type: 'wash',
                  quantity: 2,
                },
              ]),
            },
            { v: '2026-08-08 10:00:00' },
            null,
          ],
        },
      ],
    },
  })});`
}

async function withMockFetch<T>(run: (calls: FetchCall[]) => Promise<T>): Promise<T> {
  const originalFetch = globalThis.fetch
  const calls: FetchCall[] = []
  globalThis.fetch = (async (url: URL | string | { url?: string }) => {
    const stringUrl = String(url)
    calls.push({ url: stringUrl })
    return response(gvizBody())
  }) as typeof fetch

  try {
    return await run(calls)
  } finally {
    globalThis.fetch = originalFetch
  }
}

function makeService(repository: SheetRepository<OrdersDbRow>) {
  return new BaseCrudService<
    OrdersApiRow,
    OrdersListQuery,
    never,
    never,
    OrdersListResponse,
    OrdersListResponse,
    never,
    never,
    OrdersDbRow,
    typeof ordersViewFieldMap
  >({
    repository,
    api: mappingApiContract,
    // The production OrdersView module uses this same migrated field map and
    // JSON declaration. The keyword field is enabled only in this local probe
    // so the service-to-repository search-field translation is observable.
    searchFields: ['orderNumber'],
    fieldMap: ordersViewFieldMap,
    jsonColumns: ordersViewJsonColumns,
  })
}

function mapReadQueryToDb(
  service: object,
  query: ReadQueryDTO<Partial<OrdersApiRow>>,
): ReadQueryDTO<Partial<OrdersDbRow>> {
  const mapper = Reflect.get(service, 'mapReadQueryToDb')
  if (typeof mapper !== 'function') {
    throw new Error('BaseCrudService mapping method is unavailable')
  }
  return Reflect.apply(mapper, service, [query]) as ReadQueryDTO<Partial<OrdersDbRow>>
}

async function main(): Promise<void> {
  process.env.ORDERS_SPREADSHEET_ID = 'mapping-characterization-spreadsheet-id'
  process.env.APPSCRIPT_URL = 'https://script.example/mapping-characterization'

  await withMockFetch(async (calls) => {
    const repository = new SheetRepository<OrdersDbRow>({ contract: ordersViewDbContract })
    const service = makeService(repository)

    const list = await service.list({
      customerId: 'customer-1',
      keyword: '1001',
      page: '2',
      perPage: '7',
      sortBy: 'receivedDate',
      sortOrder: 'desc',
    })

    assert.deepEqual(list.items[0].items, [
      {
        id: 'item-1',
        description: 'Shirt',
        serviceType: 'wash',
        quantity: 2,
      },
    ])
    assert.equal(calls.length, 1)

    const listQuery = new URL(calls[0].url).searchParams.get('tq')
    assert.ok(listQuery?.includes("where B = 'customer-1'"))
    assert.ok(listQuery?.includes("C contains '1001'"))
    assert.ok(!listQuery?.includes('customerId'))
    assert.ok(listQuery?.includes('order by E desc'))
    assert.ok(!listQuery?.includes('receivedDate'))
    assert.ok(listQuery?.includes('limit 7\noffset 7'))

    const sourceQuery = new ReadQueryDTO<Partial<OrdersApiRow>>({
      where: { customerId: 'customer-1' },
      select: ['orderNumber', 'customerId'],
      search: { keyword: '1001', fields: ['orderNumber'] },
      sort: { field: 'receivedDate', order: 'asc' },
      pagination: { page: 3, perPage: 4 },
    })
    const mappedQuery = mapReadQueryToDb(service, sourceQuery)

    assert.deepEqual(mappedQuery.where, { customer_id: 'customer-1' })
    assert.deepEqual(mappedQuery.select, ['order_number', 'customer_id'])
    assert.deepEqual(mappedQuery.search, {
      keyword: '1001',
      fields: ['order_number'],
    })
    assert.deepEqual(mappedQuery.sort, { field: 'received_date', order: 'asc' })
    assert.deepEqual(mappedQuery.pagination, { page: 3, perPage: 4 })

    await repository.read(mappedQuery)
    assert.equal(calls.length, 2)
    const selectQuery = new URL(calls[1].url).searchParams.get('tq')
    assert.ok(selectQuery?.startsWith('select C, B'))

    await service.getById('order-1')
    assert.equal(calls.length, 3)
    const idQuery = new URL(calls[2].url).searchParams.get('tq')
    assert.ok(idQuery?.includes("where A = 'order-1'"))
    assert.ok(!idQuery?.includes('orderId'))
  })

  console.log('BaseCrudService DB mapping dry test passed')
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
