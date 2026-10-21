import assert from 'node:assert/strict'
import type { z } from 'zod'
import { customerIdMappingDbContract } from '../../../../server/sheets/CustomerIDMapping/CustomerIDMapping.db-contract.js'
import { customerUpdateSchema } from '../../../../contracts/customers/customer-api.schema.js'
import { SheetRepository } from '../../../../server/shared/repositories/sheet.repository.js'
import { customersRowSchema, customersDbContract } from '../../../../server/sheets/Customers/Customers.db-contract.js'

interface FetchCall {
  url: string
  init?: RequestInit
}

type FetchHandler = (url: string, init?: RequestInit) => Promise<Response>

const tests: Array<{ name: string; run: () => Promise<void> }> = []

function test(name: string, run: () => Promise<void>): void {
  tests.push({ name, run })
}

function response(text: string): Response {
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    text: async () => text,
    json: async () => JSON.parse(text),
  } as Response
}

function gvizBody(columns: string[], values: unknown[]): string {
  return `google.visualization.Query.setResponse(${JSON.stringify({
    status: 'ok',
    table: {
      cols: columns.map((id) => ({ id })),
      rows: [{ c: values.map((value) => (value === null ? null : { v: value })) }],
    },
  })});`
}

async function withMockFetch<T>(
  handler: FetchHandler,
  run: (calls: FetchCall[]) => Promise<T>,
): Promise<T> {
  const originalFetch = globalThis.fetch
  const calls: FetchCall[] = []
  globalThis.fetch = (async (url: URL | string | { url?: string }, init?: RequestInit) => {
    const stringUrl = String(url)
    calls.push({ url: stringUrl, init })
    return handler(stringUrl, init)
  }) as typeof fetch

  try {
    return await run(calls)
  } finally {
    globalThis.fetch = originalFetch
  }
}

async function productionCustomerService() {
  const { customerService } = await import(
    '../../../../server/modules/customers/customer.module.js'
  )
  return customerService
}

async function productionCustomerRoutes() {
  const { customerRoutes } = await import(
    '../../../../server/modules/customers/customer.module.js'
  )
  return customerRoutes
}

async function productionCustomersRepository() {
  const { getCustomersRepository } = await import(
    '../../../../server/sheets/Customers/Customers.repository.js'
  )
  return getCustomersRepository()
}

test('Customers service wiring maps rows, folds detail ids, and declares registration writes', async () => {
  process.env.CUSTOMERS_SPREADSHEET_ID = 'characterization-spreadsheet-id'

  const body = gvizBody(
    ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U'],
    [
      '2026-08-08 10:00:00',
      'e6741c92',
      null,
      'TR',
      '1234567890',
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      'Regular',
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      'Wholesale free text',
    ],
  )

  await withMockFetch(
    async () => response(body),
    async (calls) => {
      const service = await productionCustomerService()
      const result = await service.list({ page: 1, perPage: 1 })

      assert.deepEqual(result.items[0], {
        customerId: 'e6741c92',
        customerIndex: null,
        customerName: 'TR',
        phone: '1234567890',
        address: null,
        location: null,
        customerType: 'Regular',
        priceGroup: 'Wholesale free text',
      })

      const detail = await service.getById('e6741c92')
      assert.equal(detail.priceGroup, 'Wholesale free text')
      assert.equal(calls.length, 2)
      const detailQuery = new URL(calls[1].url).searchParams.get('tq')
      assert.ok(detailQuery?.includes("where B = 'e6741c92'"))
      assert.ok(!detailQuery?.includes('customerId'))
    },
  )

  assert.deepEqual(customersDbContract.writes, { append: true, update: true, delete: false })
  assert.deepEqual(customerIdMappingDbContract.writes, { append: false, update: true, delete: false })

  await withMockFetch(
    async () => response(body),
    async (calls) => {
      const routes = await productionCustomerRoutes()
      const methodNotAllowed = await routes.item?.handleRequest({
        method: 'OPTIONS',
        query: {},
        body: undefined,
        headers: {},
        params: { id: 'e6741c92' },
      })
      assert.equal(methodNotAllowed?.status, 405)
      assert.match(methodNotAllowed?.headers?.Allow ?? '', /PATCH/)

      assert.equal(calls.length, 0)
    },
  )
})

test('Customers GViz column U maps nullable and empty PriceGroup cells to priceGroup', async () => {
  process.env.CUSTOMERS_SPREADSHEET_ID = 'characterization-spreadsheet-id'
  for (const value of [null, '']) {
    await withMockFetch(
      async () => response(gvizBody(['B', 'U'], ['e6741c92', value])),
      async () => {
        const repository = await productionCustomersRepository()
        assert.deepEqual(await repository.read(), [{ CustomerID: 'e6741c92', PriceGroup: value }])
        const service = await productionCustomerService()
        assert.equal((await service.getById('e6741c92')).priceGroup, value)
      },
    )
  }
})

test('Customer PATCH requires admin before any sheet access', async () => {
  const routes = await productionCustomerRoutes()
  for (const role of ['staff', 'device', undefined] as const) {
    await withMockFetch(async () => { throw new Error('Unauthorized sheet access') }, async (calls) => {
      const result = await routes.item!.handleRequest({
        method: 'PATCH', query: {}, headers: {}, params: { id: 'e6741c92' },
        body: { customerName: 'Changed' },
        staff: role ? { staffId: 'operator', name: 'Operator', email: 'operator@example.com', role } : undefined,
      })
      assert.equal(result.status, 403)
      assert.equal(calls.length, 0)
    })
  }
})

test('Customer PATCH rejects metadata, ids, non-form fields, and empty patches', async () => {
  const routes = await productionCustomerRoutes()
  const forbidden = ['id', 'customerId', 'customerIndex', 'registeredDate', 'timestamp',
    'createdAt', 'createdBy', 'updatedAt', 'deletedAt', 'deletedBy', 'status',
    'location', 'source', 'priceGroup', 'scheduledDays', 'lastVisitDate', 'preferredContactMethod']
  for (const field of forbidden) {
    assert.equal(customerUpdateSchema.safeParse({ customerName: 'Changed', updatedBy: 'admin', [field]: 'invalid' }).success, false, field)
    await withMockFetch(async () => { throw new Error('Invalid patch reached Sheets') }, async (calls) => {
      const result = await routes.item!.handleRequest({
        method: 'PATCH', query: {}, headers: {}, params: { id: 'e6741c92' },
        body: { customerName: 'Changed', [field]: 'invalid' },
        staff: { staffId: 'admin-id', name: 'Admin', email: 'admin@example.com', role: 'admin' },
      })
      assert.equal(result.status, 422, field)
      assert.equal(calls.length, 0)
    })
  }
  for (const patch of [{ updatedBy: 'admin' }, { updatedBy: 'admin', phone: null },
    { updatedBy: 'admin', phone: '081-234-5678' }, { updatedBy: 'admin', customerName: '' }]) {
    assert.equal(customerUpdateSchema.safeParse(patch).success, false)
  }
  for (const field of ['customerName', 'phone', 'address', 'facebook', 'lineId', 'whatsapp', 'email']) {
    const value = field === 'phone' ? '0812345678' : 'Changed'
    assert.equal(customerUpdateSchema.safeParse({ updatedBy: 'admin', [field]: value }).success, true, field)
  }
})

test('Customer PATCH accepts known customer types and rejects unknown types without sheet access', async () => {
  for (const customerType of ['Member', 'Regular', 'Corporate']) {
    assert.equal(customerUpdateSchema.safeParse({ customerType, updatedBy: 'admin' }).success, true)
  }
  assert.equal(customerUpdateSchema.safeParse({ updatedBy: 'admin' }).success, false)
  await withMockFetch(async () => { throw new Error('Invalid type reached Sheets') }, async (calls) => {
    const routes = await productionCustomerRoutes()
    const result = await routes.item!.handleRequest({
      method: 'PATCH', query: {}, headers: {}, params: { id: 'e6741c92' },
      body: { customerType: 'Unknown' },
      staff: { staffId: 'admin-id', name: 'Admin', email: 'admin@example.com', role: 'admin' },
    })
    assert.equal(result.status, 422)
    assert.equal(calls.length, 0)
  })
})

test('Admin PATCH writes only supplied fields and server audit columns through Sheets API', async () => {
  const repository = await productionCustomersRepository()
  const originalUpdate = repository.update
  const headers = Object.keys(customersRowSchema.shape)
  const values = headers.map((header) => ({
    Timestamp: '2026-08-08 10:00:00', CustomerID: 'e6741c92', CustomerIndex: 'ABC',
    CustomerName: 'Changed', Phone: '0812345678', CustomerType: 'Member', UpdatedBy: 'admin-id',
  }[header] ?? null))
  await withMockFetch(async (url, init) => {
    const path = decodeURIComponent(new URL(url).pathname)
    if (url.includes('/gviz/')) return response(gvizBody(['B', 'D'], ['e6741c92', 'Original']))
    if (path.endsWith('/values/Customers!1:1')) return response(JSON.stringify({ values: [headers] }))
    if (path.endsWith('/values/Customers!B:B')) return response(JSON.stringify({ values: [['CustomerID'], ['e6741c92']] }))
    if (path.endsWith('/values:batchUpdate') && init?.method === 'POST') {
      return response(JSON.stringify({ responses: [{}, {}, {}, {}, {}] }))
    }
    if (path.endsWith('/values/Customers!A2:U2')) return response(JSON.stringify({ values: [values] }))
    throw new Error(`Unexpected request: ${url}`)
  }, async (calls) => {
    const writableRepository = new SheetRepository<z.infer<typeof customersRowSchema>>({
      contract: customersDbContract,
      sheetsApiClientOptions: { fetchImpl: globalThis.fetch, accessTokenProvider: async () => 'test-token' },
    })
    repository.update = writableRepository.update.bind(writableRepository)
    try {
      const routes = await productionCustomerRoutes()
      const result = await routes.item!.handleRequest({
        method: 'PATCH', query: {}, headers: {}, params: { id: 'e6741c92' },
        body: { customerName: 'Changed', address: null, customerType: 'Member', updatedBy: 'spoofed-actor' },
        staff: { staffId: 'admin-id', name: 'Admin', email: 'admin@example.com', role: 'admin' },
      })
      assert.equal(result.status, 200, JSON.stringify(result.body))
      const writes = calls.filter((call) => call.init?.method === 'POST')
      assert.equal(writes.length, 1)
      const body = JSON.parse(String(writes[0].init?.body)) as {
        data: Array<{ range: string; values: unknown[][] }>
      }
      const cells = Object.fromEntries(body.data.map((cell) => [cell.range, cell.values[0][0]]))
      assert.deepEqual(Object.keys(cells).sort(), ['Customers!D2:D2', 'Customers!F2:F2', 'Customers!M2:M2', 'Customers!R2:R2', 'Customers!S2:S2'])
      assert.equal(cells['Customers!D2:D2'], 'Changed')
      assert.equal(cells['Customers!F2:F2'], '')
      assert.equal(cells['Customers!M2:M2'], 'Member')
      assert.equal(cells['Customers!S2:S2'], 'admin-id')
      assert.match(String(cells['Customers!R2:R2']), /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)
    } finally {
      repository.update = originalUpdate
    }
  })
})

for (const scenario of [
  { name: 'another live customer owns the phone', customerId: 'other-id', deletedAt: null, status: 409 },
  { name: 'the same customer keeps their own phone', customerId: 'e6741c92', deletedAt: '', status: 200 },
  { name: 'a deleted customer used the phone', customerId: 'other-id', deletedAt: '2026-01-01 00:00:00', status: 200 },
]) {
  test(`Customer phone PATCH: ${scenario.name}`, async () => {
    const repository = await productionCustomersRepository()
    const originalUpdate = repository.update
    const writes: Array<Partial<z.infer<typeof customersRowSchema>>> = []
    repository.update = async (customerId, patch) => {
      writes.push(patch)
      return customersRowSchema.parse({
        ...Object.fromEntries(Object.keys(customersRowSchema.shape).map((field) => [field, null])),
        Timestamp: '2026-10-21 10:00:00', CustomerID: customerId, CustomerIndex: 'ABC',
        CustomerName: 'Original', ...patch,
      })
    }
    try {
      await withMockFetch(async (url) => {
        const query = new URL(url).searchParams.get('tq') ?? ''
        if (query.includes("where B = 'e6741c92'")) {
          return response(gvizBody(['B', 'D', 'E'], ['e6741c92', 'Original', '081-234-5678']))
        }
        return response(gvizBody(['B', 'E', 'T'], [scenario.customerId, '081-234-5678', scenario.deletedAt]))
      }, async (calls) => {
        const routes = await productionCustomerRoutes()
        const result = await routes.item!.handleRequest({
          method: 'PATCH', query: {}, headers: {}, params: { id: 'e6741c92' },
          body: { phone: '0812345678' },
          staff: { staffId: 'admin-id', name: 'Admin', email: 'admin@example.com', role: 'admin' },
        })
        assert.equal(result.status, scenario.status, JSON.stringify(result.body))
        assert.equal(writes.length, scenario.status === 409 ? 0 : 1)
        assert.equal(calls.some((call) => call.init?.method === 'POST'), false)
        if (scenario.status === 409) {
          assert.deepEqual((result.body as { error: unknown }).error, {
            code: 'CONFLICT', message: 'duplicate_phone', details: { code: 'duplicate_phone' },
          })
        } else {
          assert.deepEqual(writes[0], { Phone: '0812345678', UpdatedBy: 'admin-id' })
        }
      })
    } finally {
      repository.update = originalUpdate
    }
  })
}

async function main(): Promise<void> {
  for (const item of tests) {
    await item.run()
  }
  console.log(`${tests.length} Customers wiring dry test passed`)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
