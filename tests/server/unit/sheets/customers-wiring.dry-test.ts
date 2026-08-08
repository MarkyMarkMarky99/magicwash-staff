import assert from 'node:assert/strict'

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

test('Customers service wiring maps rows, folds detail ids, and preserves write failure', async () => {
  process.env.CUSTOMERS_SPREADSHEET_ID = 'characterization-spreadsheet-id'
  process.env.APPSCRIPT_URL = 'https://script.example/characterization'

  const body = gvizBody(
    ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T'],
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
      })

      await service.getById('e6741c92')
      assert.equal(calls.length, 2)
      const detailQuery = new URL(calls[1].url).searchParams.get('tq')
      assert.ok(detailQuery?.includes("where B = 'e6741c92'"))
      assert.ok(!detailQuery?.includes('customerId'))
    },
  )

  await withMockFetch(
    async () => response(body),
    async (calls) => {
      const service = await productionCustomerService()

      await assert.rejects(
        () =>
          service.create({
            customerName: 'TR',
            phone: '1234567890',
            updatedBy: 'test-user',
          }),
        /SheetRepository writes require an explicit SheetLib target/,
      )
      assert.equal(calls.length, 0)
    },
  )

  await withMockFetch(
    async () => response(body),
    async (calls) => {
      const routes = await productionCustomerRoutes()
      const repository = await productionCustomersRepository()

      const methodNotAllowed = await routes.item?.handleRequest({
        method: 'OPTIONS',
        query: {},
        body: undefined,
        headers: {},
        params: { id: 'e6741c92' },
      })
      assert.equal(methodNotAllowed?.status, 405)
      assert.match(methodNotAllowed?.headers?.Allow ?? '', /PATCH/)

      await assert.rejects(
        () => repository.update('e6741c92', { CustomerName: 'TR' }),
        /SheetRepository writes require an explicit SheetLib target/,
      )
      assert.equal(calls.length, 0)
    },
  )
})

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
