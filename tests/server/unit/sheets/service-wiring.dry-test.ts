import assert from 'node:assert/strict'

// ── Drives the REAL production wiring: the services exported by
//    order.module.ts / appointment.module.ts, built on the real repository
//    getters, contracts and transformers. Rebuilding an "equivalent" service
//    here would assert nothing — a test that wires the transformer in itself
//    still passes when production stops wiring it in, which is exactly the
//    regression this file exists to catch.
//
//    Both modules construct their service at import time, and that reaches a
//    repository constructor which reads env. ESM evaluates imports before the
//    module body, so the env has to be set first and the modules pulled in with
//    a dynamic import inside each test rather than a static one at the top. ──
process.env.ORDERS_SPREADSHEET_ID = 'characterization-spreadsheet-id'
process.env.APPOINTMENTS_SPREADSHEET_ID = 'characterization-spreadsheet-id'
process.env.APPSCRIPT_URL = 'https://script.example/characterization'

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

/** The service the API actually serves `/api/orders` with. */
async function productionOrdersService() {
  const { ordersService } = await import('../../../../server/modules/orders/order.module.js')
  return ordersService
}

/** The service the API actually serves `/api/appointments` with. */
async function productionAppointmentService() {
  const { appointmentService } = await import(
    '../../../../server/modules/appointments/appointment.module.js'
  )
  return appointmentService
}

/** The service the API actually serves `/api/invoices` with. */
async function productionInvoiceService() {
  const { invoiceService } = await import('../../../../server/modules/invoices/invoice.module.js')
  return invoiceService
}

/** The service the API actually serves `/api/customer-packages` with. */
async function productionCustomerPackageService() {
  const { customerPackageViewService } = await import(
    '../../../../server/modules/customer-packages/customer-package-view.module.js'
  )
  return customerPackageViewService
}

test('OrdersView service wiring maps DB columns and decodes the declared JSON cell', async () => {
  const itemsJson = JSON.stringify([
    {
      id: 'item-1',
      description: 'Shirt',
      service_type: 'ซักรีด',
      quantity: 2,
    },
  ])
  const body = gvizBody(
    ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M'],
    [
      'AFT-1001',
      'customer-1',
      '1001',
      null,
      'Date(2026,6,21)',
      'Date(2026,6,23)',
      'ซักรีด',
      'CONFIRM',
      3,
      'Call before delivery',
      itemsJson,
      '2026-07-21 10:00:00',
      null,
    ],
  )

  await withMockFetch(
    async () => response(body),
    async (calls) => {
      const result = await (await productionOrdersService()).list({
        customerId: 'customer-1',
        page: 1,
        perPage: 1,
      })
      const row = result.items[0]

      assert.equal(calls.length, 1)
      assert.ok(calls[0].url.includes('/gviz/tq'))
      assert.deepEqual(row.items, [
        {
          id: 'item-1',
          description: 'Shirt',
          serviceType: 'ซักรีด',
          quantity: 2,
        },
      ])
      assert.notEqual(row.items, itemsJson)
      assert.notEqual(row.items, undefined)
      // The backend no longer normalizes GViz dates; the frontend owns display
      // formatting, matching the InvoicesView and Appointments read paths.
      assert.equal(row.receivedDate, 'Date(2026,6,21)')
      assert.equal(row.dueDate, 'Date(2026,6,23)')
      assert.equal(row.quantity, 3)
      assert.equal(typeof row.quantity, 'number')
    },
  )
})

test('OrdersView JSON declaration safely falls back for malformed and empty cells', async () => {
  const values = [
    'AFT-1001',
    'customer-1',
    '1001',
    null,
    'Date(2026,6,21)',
    'Date(2026,6,23)',
    'ซักรีด',
    'CONFIRM',
    3,
    'Call before delivery',
    '{bad json',
    '2026-07-21 10:00:00',
    null,
  ]
  const emptyValues = [...values]
  emptyValues[10] = null
  const bodies = [
    gvizBody(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M'], values),
    gvizBody(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M'], emptyValues),
  ]

  await withMockFetch(
    async (_url, _init) => response(bodies.shift()!),
    async () => {
      const service = await productionOrdersService()
      const malformed = await service.list({ customerId: 'customer-1', page: 1, perPage: 1 })
      const empty = await service.list({ customerId: 'customer-1', page: 1, perPage: 1 })

      assert.deepEqual(malformed.items[0].items, [])
      assert.deepEqual(empty.items[0].items, [])
    },
  )
})

test('Appointments service wiring flattens the Address snapshot', async () => {
  const addressJson = JSON.stringify({
    CustomerName: 'Jane Doe',
    CustomerLabel: 'C-001',
    Phone: '0812345678',
    Address: '123 Main Road',
    Location: 'Bangkok',
  })
  const body = gvizBody(
    ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q'],
    [
      'APPT-a1b2c3d4',
      'customer-1',
      'PICKUP',
      '2026-07-21',
      '10:00-12:00',
      'CONFIRMED',
      addressJson,
      null,
      null,
      'Call before delivery',
      '2026-07-21 10:00:00',
      null,
      'staff-1',
      null,
      'STANDARD',
      null,
      null,
    ],
  )

  await withMockFetch(
    async () => response(body),
    async (calls) => {
      const result = await (await productionAppointmentService()).list({ page: 1, perPage: 1 })
      const row = result.items[0]

      assert.equal(calls.length, 1)
      assert.ok(calls[0].url.includes('/gviz/tq'))
      assert.equal(row.customerName, 'Jane Doe')
      assert.equal(row.customerCode, 'C-001')
      assert.equal(row.phone, '0812345678')
      assert.equal(row.location, 'Bangkok')
      assert.equal(row.address, '123 Main Road')
    },
  )
})

test('InvoicesView service wiring decodes object and array JSON cells', async () => {
  const body = gvizBody(
    ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q'],
    [
      'INV-2026-0001',
      'PAID',
      'ORDER',
      null,
      null,
      'Date(2026,7,6)',
      'Date(2026,7,8)',
      'd2ec63e7',
      JSON.stringify({
        customer_code: 'd2ec63e7',
        customer_name: 'Punch Aonny',
        phone: '0812345678',
        address: '123 Main Road',
      }),
      JSON.stringify([
        {
          description: 'Shirt',
          unit: 'piece',
          quantity: 1,
          unit_price: 990,
          subtotal: 990,
          adjustments: [],
          net_total: 990,
        },
      ]),
      JSON.stringify([
        {
          label: 'Promo',
          calculation: 'FIXED',
          value: -10,
          ref_source: null,
          ref_code: null,
        },
      ]),
      JSON.stringify([
        {
          payment_id: 'payment-1',
          amount: 0,
          method: 'CASH',
          status: 'PENDING',
          paid_at: null,
          reference: null,
          proof_url: null,
          notes: null,
        },
      ]),
      990,
      0,
      990,
      0,
      990,
    ],
  )

  await withMockFetch(
    async () => response(body),
    async (calls) => {
      const service = await productionInvoiceService()
      const result = await service.list({ page: '1', perPage: '1' })
      const listRow = result.items[0]

      assert.equal(calls.length, 1)
      assert.deepEqual(listRow.customer, {
        customerCode: 'd2ec63e7',
        customerName: 'Punch Aonny',
        phone: '0812345678',
        address: '123 Main Road',
      })
      assert.deepEqual(listRow.adjustments, [
        {
          label: 'Promo',
          calculation: 'FIXED',
          value: -10,
          refSource: null,
          refCode: null,
        },
      ])
      assert.equal(listRow.issuedDate, 'Date(2026,7,6)')
      assert.equal(listRow.subtotal, 990)
      assert.equal(listRow.grandTotal, 990)
      assert.equal(listRow.paidAmount, 0)
      assert.equal(listRow.balanceDue, 990)

      const detail = await service.getById('INV-2026-0001')
      assert.deepEqual(detail.items, [
        {
          description: 'Shirt',
          unit: 'piece',
          quantity: 1,
          unitPrice: 990,
          subtotal: 990,
          adjustments: [],
          netTotal: 990,
        },
      ])
      assert.deepEqual(detail.payments, [
        {
          paymentId: 'payment-1',
          amount: 0,
          method: 'CASH',
          status: 'PENDING',
          paidAt: null,
          reference: null,
          proofUrl: null,
          notes: null,
        },
      ])
      assert.equal(calls.length, 2)
    },
  )
})

test('InvoicesView date-range wiring maps DB rows before safe JSON fallbacks', async () => {
  const values = [
    'INV-2026-0002',
    'UNPAID',
    'ORDER',
    null,
    null,
    '2026-08-06',
    '2026-08-08',
    'd2ec63e7',
    '{bad json',
    '',
    'not an array',
    null,
    990,
    0,
    990,
    0,
    990,
  ]

  await withMockFetch(
    async () =>
      response(
        gvizBody(
          ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q'],
          values,
        ),
      ),
    async () => {
      const result = await (
        await productionInvoiceService()
      ).list({ dateFrom: '2026-08-01', dateTo: '2026-08-31', page: '1', perPage: '1' })
      const row = result.items[0]

      assert.deepEqual(row.customer, null)
      assert.deepEqual(row.adjustments, [])
      assert.equal(row.issuedDate, '2026-08-06')
    },
  )
})

test('CustomerPackageView service wiring decodes and safely falls back for transactions JSON', async () => {
  const validBody = gvizBody(
    ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S'],
    [
      'package-1',
      'd2ec63e7',
      'Punch Aonny',
      '0812345678',
      '123 Main Road',
      'PKG-10',
      'Ten Washes',
      'WSIR',
      '2026-08-01',
      '2026-09-01',
      'ACTIVE',
      'MON',
      '10:00-12:00',
      null,
      null,
      9,
      1,
      10,
      JSON.stringify([
        {
          id: 'tx-1',
          type: 'USAGE',
          credit_change: -1,
          remaining_credit: 9,
          reference_source: 'ORDER',
          reference_id: 'order-1',
          notes: null,
          created_at: '2026-08-02 10:00:00',
        },
      ]),
    ],
  )
  const malformedBody = gvizBody(
    ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S'],
    [
      'package-2',
      'd2ec63e7',
      'Punch Aonny',
      '0812345678',
      '123 Main Road',
      'PKG-10',
      'Ten Washes',
      'WSIR',
      '2026-08-01',
      '2026-09-01',
      'ACTIVE',
      'MON',
      '10:00-12:00',
      null,
      null,
      10,
      0,
      10,
      '{bad json',
    ],
  )

  await withMockFetch(
    async () => response(validBody),
    async (calls) => {
      const service = await productionCustomerPackageService()
      const listRow = (await service.list({ page: 1, perPage: 1 })).items[0]
      assert.equal(calls.length, 1)
      assert.equal(listRow.customerName, 'Punch Aonny')

      const detail = await service.getById('package-1')
      assert.deepEqual(detail.transactions, [
        {
          id: 'tx-1',
          type: 'USAGE',
          creditChange: -1,
          remainingCredit: 9,
          referenceSource: 'ORDER',
          referenceId: 'order-1',
          notes: null,
          createdAt: '2026-08-02 10:00:00',
        },
      ])
      assert.equal(calls.length, 2)
    },
  )

  await withMockFetch(
    async () => response(malformedBody),
    async () => {
      const detail = await (await productionCustomerPackageService()).getById('package-2')
      assert.deepEqual(detail.transactions, [])
    },
  )
})

async function main(): Promise<void> {
  for (const item of tests) {
    await item.run()
  }
  console.log(`${tests.length} service-wiring dry tests passed`)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
