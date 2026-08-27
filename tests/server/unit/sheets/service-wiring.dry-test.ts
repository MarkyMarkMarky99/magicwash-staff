import assert from 'node:assert/strict'
import { generateKeyPairSync } from 'node:crypto'
import { deriveGVizColumns, type GSheetRowSchema } from '../../../../server/shared/repositories/utils/gviz-query.builder.js'
import { customerPackagesRowSchema } from '../../../../server/sheets/CustomerPackages/CustomerPackages.db-contract.js'
import { packageTransactionsRowSchema } from '../../../../server/sheets/PackageTransactions/PackageTransactions.db-contract.js'
import { packagesRowSchema } from '../../../../server/sheets/Packages/Packages.db-contract.js'
import { customersRowSchema } from '../../../../server/sheets/Customers/Customers.db-contract.js'

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
process.env.PORTAL_SPREADSHEET_ID = 'characterization-spreadsheet-id'
process.env.APPOINTMENTS_SPREADSHEET_ID = 'characterization-spreadsheet-id'
process.env.LAUNDRY_PACKAGES_SPREADSHEET_ID = 'characterization-spreadsheet-id'
process.env.CUSTOMERS_SPREADSHEET_ID = 'characterization-customers-id'
const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
process.env.GOOGLE_SERVICE_ACCOUNT_KEY = Buffer.from(JSON.stringify({
  client_email: 'service-wiring@example.test',
  private_key: String(privateKey.export({ format: 'pem', type: 'pkcs8' })),
})).toString('base64')

interface FetchCall {
  url: string
  init?: RequestInit
}

type FetchHandler = (url: string, init?: RequestInit) => Promise<Response>

const tests: Array<{ name: string; run: () => Promise<void> }> = []

function test(name: string, run: () => Promise<void>): void {
  tests.push({ name, run })
}

function response(text: string, json?: unknown): Response {
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    text: async () => text,
    json: async () => json,
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

function sheetGvizBody(rowSchema: GSheetRowSchema, values: unknown[]): string {
  const columns = deriveGVizColumns(rowSchema)
  const keys = Object.keys(rowSchema.shape)
  assert.equal(values.length, keys.length)
  return gvizBody(keys.map((key) => columns[key]), values)
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
  const { customerPackageReadService } = await import(
    '../../../../server/modules/customer-packages/customer-package-view.module.js'
  )
  return customerPackageReadService
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
      assert.equal(row.invoiceNumber, null)
      // The backend does not normalize GViz dates; the frontend owns display
      // formatting.
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

test('Appointments create wiring packs Address and uses the DB primary-key column', async () => {
  const appointmentHeaders = [
    'AppointmentID',
    'CustomerID',
    'AppointmentType',
    'AppointmentDate',
    'TimeSlot',
    'Status',
    'Address',
    'PickupOrderID',
    'DeliveryOrderID',
    'Notes',
    'CreatedAt',
    'UpdatedAt',
    'CreatedBy',
    'UpdatedBy',
    'ServiceTier',
    'DeletedAt',
    'DeletedBy',
  ] as const

  await withMockFetch(
    async (url, init) => {
      if (url === 'https://oauth2.googleapis.com/token') {
        return response('', { access_token: 'test-access-token', expires_in: 3600 })
      }

      const path = decodeURIComponent(new URL(url).pathname)
      if (init?.method === 'GET' && path.endsWith('/values/Appointments!1:1')) {
        return response('', { values: [appointmentHeaders] })
      }
      if (init?.method === 'GET' && path.endsWith('/values/Appointments!A:A')) {
        return response('', { values: [['AppointmentID']] })
      }
      if (init?.method === 'POST' && path.endsWith('/values/Appointments:append')) {
        const request = JSON.parse(String(init.body)) as {
          majorDimension: string
          values: unknown[][]
        }
        return response('', {
          spreadsheetId: 'characterization-spreadsheet-id',
          updates: {
            updatedRows: 1,
            updatedData: { values: request.values },
          },
        })
      }

      throw new Error(`Unexpected Appointments Sheets API request: ${init?.method} ${path}`)
    },
    async (calls) => {
      const result = await (await productionAppointmentService()).create({
        customerId: 'customer-1',
        customerName: 'ธนวดี',
        customerCode: 'WIX',
        phone: '0917382178',
        address: '123 Main Road',
        location: 'https://maps.example/appointment',
        appointmentType: 'DELIVERY',
        appointmentDate: '2026-02-29',
        timeSlot: '18:00-20:00',
        createdBy: 'test-user',
      })

      assert.equal(calls.length, 4)
      assert.equal(calls[0].url, 'https://oauth2.googleapis.com/token')
      assert.equal(calls[1].init?.method, 'GET')
      assert.equal(
        decodeURIComponent(new URL(calls[1].url).pathname).endsWith('/values/Appointments!1:1'),
        true,
      )
      assert.equal(calls[2].init?.method, 'GET')
      assert.equal(
        decodeURIComponent(new URL(calls[2].url).pathname).endsWith('/values/Appointments!A:A'),
        true,
      )
      assert.equal(calls[3].init?.method, 'POST')

      const appendUrl = new URL(calls[3].url)
      assert.equal(appendUrl.searchParams.get('valueInputOption'), 'USER_ENTERED')
      assert.equal(appendUrl.searchParams.get('insertDataOption'), 'INSERT_ROWS')
      assert.equal(appendUrl.searchParams.get('includeValuesInResponse'), 'true')
      assert.equal(appendUrl.searchParams.get('responseValueRenderOption'), 'UNFORMATTED_VALUE')

      const request = JSON.parse(calls[3].init?.body as string) as {
        majorDimension: string
        values: unknown[][]
      }
      assert.deepEqual(Object.keys(request), ['majorDimension', 'values'])
      assert.equal(request.majorDimension, 'ROWS')
      assert.equal(request.values.length, 1)

      const row = request.values[0]
      assert.equal(row?.length, appointmentHeaders.length)
      assert.equal(appointmentHeaders[0], 'AppointmentID')
      assert.match(String(row?.[0]), /^APPT-[0-9a-f]{8}$/)
      assert.equal(row?.[1], 'customer-1')
      assert.equal(row?.[2], 'DELIVERY')
      assert.equal(row?.[3], '2026-02-29')
      assert.equal(row?.[5], 'CONFIRMED')
      assert.deepEqual(JSON.parse(String(row?.[6])), {
        CustomerName: 'ธนวดี',
        CustomerLabel: 'WIX',
        Phone: '0917382178',
        Address: '123 Main Road',
        Location: 'https://maps.example/appointment',
      })
      assert.equal(row?.[9], '')
      assert.equal(row?.[13], '')
      assert.equal(row?.[14], 'STANDARD')
      assert.equal(row?.[15], '')
      assert.equal(row?.[16], '')
      assert.equal(result.customerName, 'ธนวดี')
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
    [
      'A',
      'B',
      'C',
      'D',
      'E',
      'F',
      'G',
      'H',
      'I',
      'J',
      'K',
      'L',
      'M',
      'N',
      'O',
      'P',
      'Q',
    ],
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

test('customer-package read service assembles list and detail from four source sheets', async () => {
  await withMockFetch(
    async (url) => {
      switch (new URL(url).searchParams.get('sheet')) {
        case 'CustomerPackages':
          return response(sheetGvizBody(customerPackagesRowSchema, [
            'package-1', 'd2ec63e7', 'PKG-10', '2026-08-01', '2026-09-01', 'MON', '10:00-12:00',
            null, null, '2026-08-01 09:00:00', 'staff-1', null, null, null, null,
          ]))
        case 'PackageTransactions':
          return response(sheetGvizBody(packageTransactionsRowSchema, [
            'tx-1', 'package-1', 'd2ec63e7', 'PURCHASE', 'CustomerPackages', 'package-1', 10, null,
            'Date(2026,7,1,9,30,0)', 'staff-1',
          ]))
        case 'Packages':
          return response(sheetGvizBody(packagesRowSchema, [
            'PKG-10', 'Ten Washes', 'WSIR', 10, 1000, null, '2026-07-01 09:00:00', 'staff-1',
            '2026-07-01 09:00:00', 'staff-1', '2026-08-01', 'staff-1',
          ]))
        case 'Customers':
          return response(sheetGvizBody(customersRowSchema, [
            '2026-07-01 09:00:00', 'd2ec63e7', '1', 'Punch Aonny', '0812345678', '123 Main Road',
            null, null, null, null, null, null, 'Regular', null, null, null, null, null, null, null,
          ]))
        default:
          throw new Error(`Unexpected customer-package sheet: ${new URL(url).searchParams.get('sheet')}`)
      }
    },
    async (calls) => {
      const service = await productionCustomerPackageService()
      const listRow = (await service.list({ page: 1, perPage: 1 })).items[0]
      assert.equal(calls.length, 4)
      assert.equal(listRow.customerName, 'Punch Aonny')
      assert.equal('transactions' in listRow, false)

      calls.length = 0
      const detail = await service.getById('package-1')
      assert.equal(calls.length, 4)
      assert.deepEqual(detail.transactions, [
        {
          id: 'tx-1',
          type: 'PURCHASE',
          creditChange: 10,
          remainingCredit: 10,
          referenceSource: 'CustomerPackages',
          referenceId: 'package-1',
          notes: null,
          createdAt: '2026-08-01 09:30:00',
        },
      ])
      assert.equal(detail.customerName, 'Punch Aonny')
      assert.equal(detail.packageName, 'Ten Washes')
      assert.ok(detail.transactions.every((entry) => !entry.createdAt.includes('T') && !entry.createdAt.includes('+07:00')))
    },
  )
})

test('customer-package write wiring preserves field maps, shared singletons, and route contracts', async () => {
  const [
    viewModule,
    purchaseModule,
    transactionModule,
    packageRoutesModule,
    customerPackagesRepositoryModule,
    packageTransactionsRepositoryModule,
    packagesRepositoryModule,
  ] = await Promise.all([
    import('../../../../server/modules/customer-packages/customer-package-view.module.js'),
    import('../../../../server/modules/customer-packages/customer-package-purchase.service.js'),
    import('../../../../server/modules/customer-packages/package-transaction.service.js'),
    import('../../../../server/modules/customer-packages/package-transaction.module.js'),
    import('../../../../server/sheets/CustomerPackages/CustomerPackages.repository.js'),
    import('../../../../server/sheets/PackageTransactions/PackageTransactions.repository.js'),
    import('../../../../server/sheets/Packages/Packages.repository.js'),
  ])

  const { customerPackageRoutes, customerPackageReadService } = viewModule
  const { customerPackagePurchaseService } = purchaseModule
  const { packageTransactionService } = transactionModule
  const { packageTransactionRoutes } = packageRoutesModule

  const purchaseInternals = customerPackagePurchaseService as unknown as {
    transactionService: unknown
    packageRepository: unknown
    catalogRepository: unknown
  }
  const transactionInternals = packageTransactionService as unknown as {
    packageRepository: unknown
    transactionRepository: unknown
  }
  assert.strictEqual(purchaseInternals.transactionService, packageTransactionService)
  assert.strictEqual(purchaseInternals.packageRepository, customerPackagesRepositoryModule.getCustomerPackagesRepository)
  assert.strictEqual(purchaseInternals.catalogRepository, packagesRepositoryModule.getPackagesRepository)
  assert.strictEqual(transactionInternals.packageRepository, customerPackagesRepositoryModule.getCustomerPackagesRepository)
  assert.strictEqual(transactionInternals.transactionRepository, packageTransactionsRepositoryModule.getPackageTransactionsRepository)

  const { customerPackagesFieldMap, packageTransactionsFieldMap, packagesFieldMap } = await import(
    '../../../../server/modules/customer-packages/customer-package.mapping.js'
  )
  assert.deepEqual(customerPackagesFieldMap, {
    id: 'customerPackageId', customer_id: 'customerId', package_code: 'packageCode',
    start_date: 'startDate', expiry_date: 'expiryDate', service_day: 'serviceDay',
    time_slot: 'timeSlot', invoice_id: 'invoiceId', notes: 'notes', created_at: 'createdAt',
    created_by: 'createdBy', updated_at: 'updatedAt', updated_by: 'updatedBy',
    deleted_at: 'deletedAt', deleted_by: 'deletedBy',
  })
  assert.deepEqual(packageTransactionsFieldMap, {
    id: 'transactionId', customer_package_id: 'customerPackageId', customer_id: 'customerId',
    type: 'type', reference_source: 'referenceSource', reference_id: 'referenceId',
    credit_change: 'creditChange', notes: 'notes', created_at: 'createdAt', created_by: 'createdBy',
  })
  assert.deepEqual(packagesFieldMap, {
    package_code: 'packageCode', name: 'name', eligible_service: 'eligibleService',
    included_credit: 'includedCredit', price: 'price', notes: 'notes', created_at: 'createdAt',
    created_by: 'createdBy', updated_at: 'updatedAt', updated_by: 'updatedBy',
    deleted_at: 'deletedAt', deleted_by: 'deletedBy',
  })

  const request = (method: string, body: unknown = undefined, params: Record<string, string> = {}) => ({
    method, query: {}, body, headers: {}, params,
  })

  const purchaseMethods = customerPackagePurchaseService as unknown as {
    create: (payload: unknown) => Promise<unknown>
  }
  const originalPurchaseCreate = purchaseMethods.create
  const createdResponse = {
    kind: 'created', customerPackageId: 'package-1', customerId: 'customer-1',
    packageCode: 'GOLD', openingCredit: 10, transactionId: 'transaction-1',
    createdAt: '2026-08-25 12:00:01',
  }
  purchaseMethods.create = async () => createdResponse
  try {
    const result = await customerPackageRoutes.collection.handleRequest(request('POST'))
    assert.equal(result.status, 201)
    assert.deepEqual(result.body, createdResponse)
    assert.equal('success' in (result.body as object), false)
  } finally {
    purchaseMethods.create = originalPurchaseCreate
  }

  const readMethods = customerPackageReadService as unknown as {
    list: (query: unknown) => Promise<unknown>
    getById: (id: string) => Promise<unknown>
  }
  const originalList = readMethods.list
  const originalGetById = readMethods.getById
  const viewRow = { customerPackageId: 'package-1', status: 'ACTIVE', transactions: [] }
  readMethods.list = async () => ({ items: [viewRow], pagination: { page: 1, perPage: 1, total: 1, totalPages: 1 } })
  readMethods.getById = async () => viewRow
  try {
    const listResult = await customerPackageRoutes.collection.handleRequest(request('GET'))
    assert.equal(listResult.status, 200)
    assert.equal((listResult.body as { success: boolean }).success, true)
    assert.deepEqual((listResult.body as { data: unknown }).data, [viewRow])

    const detailResult = await customerPackageRoutes.item!.handleRequest(request('GET', undefined, { id: 'package-1' }))
    assert.equal(detailResult.status, 200)
    assert.deepEqual((detailResult.body as { data: unknown }).data, viewRow)
  } finally {
    readMethods.list = originalList
    readMethods.getById = originalGetById
  }

  const patchResult = await customerPackageRoutes.item!.handleRequest(request('PATCH', {}, { id: 'package-1' }))
  assert.equal(patchResult.status, 404)
  assert.equal((patchResult.body as { success: boolean }).success, false)
  assert.equal((patchResult.body as { error: { code: string } }).error.code, 'NOT_FOUND')

  const transactionMethods = packageTransactionService as unknown as {
    append: (payload: unknown) => Promise<unknown>
  }
  const originalTransactionAppend = transactionMethods.append
  const transactionResponse = {
    kind: 'created', transactionId: 'transaction-1', customerPackageId: 'package-1',
    customerId: 'customer-1', type: 'USAGE', creditChange: -1,
    createdAt: '2026-08-25 12:00:02',
  }
  transactionMethods.append = async () => transactionResponse
  try {
    const result = await packageTransactionRoutes.collection.handleRequest(request('POST'))
    assert.equal(result.status, 201)
    assert.deepEqual(result.body, transactionResponse)
    assert.equal('success' in (result.body as object), false)
  } finally {
    transactionMethods.append = originalTransactionAppend
  }

  const methodResult = await packageTransactionRoutes.collection.handleRequest(request('GET'))
  assert.equal(methodResult.status, 405)
  assert.equal((methodResult.headers as { Allow: string }).Allow, 'POST')
  assert.equal(packageTransactionRoutes.item, undefined)
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
