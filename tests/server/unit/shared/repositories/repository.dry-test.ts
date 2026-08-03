import assert from 'node:assert/strict'
import { z } from 'zod'
import {
  BaseRepository,
  type FieldMap,
  type RepositoryRequest,
  type RepositoryTransformer,
} from '../../../../../server/shared/repositories/base.repository.js'
import type { ReadQueryDTO } from '../../../../../server/shared/dtos/read-query.dto.js'
import type { ModuleContract } from '../../../../../server/shared/contracts/module-db-contract.js'
import { GSheetRepository } from '../../../../../server/shared/repositories/gsheet.repository.js'
import { customerContract, customerFieldMap } from '../../../../../server/modules/customers/customer.contract.js'
import {
  SheetLibRejectedError,
  SheetLibTransportError,
} from '../../../../../server/shared/repositories/sheetlib-errors.js'

// GSheetRepository resolves config values from env var KEY NAMES. Spreadsheet
// config is resolved lazily only for GViz reads so writer-only repositories do
// not need an unrelated spreadsheet id.
process.env.TEST_SPREADSHEET_ID = 'spreadsheet-id'
process.env.TEST_SCRIPT_URL = 'https://script.example/exec'

type AnyRow = Record<string, unknown>

class TestRepository extends BaseRepository<AnyRow, AnyRow, AnyRow, AnyRow> {
  lastRequest?: RepositoryRequest<unknown, unknown>
  nextResponse: unknown = {}

  constructor(input: {
    fieldMap?: FieldMap
    primaryKey: string
    transformer?: RepositoryTransformer
  }) {
    super(input)
  }

  read(query?: ReadQueryDTO<AnyRow>): Promise<Array<Partial<AnyRow>>> {
    return this.request<Array<Partial<AnyRow>>, ReadQueryDTO<AnyRow>, never>({
      operation: 'read',
      query,
    })
  }

  create(data: AnyRow): Promise<AnyRow> {
    return this.request<AnyRow, never, AnyRow>({ operation: 'create', data })
  }

  update(id: string, data: AnyRow): Promise<AnyRow> {
    return this.request<AnyRow, { id: string }, AnyRow>({
      operation: 'update',
      query: { id },
      data,
    })
  }

  delete(id: string): Promise<unknown> {
    return this.request<unknown, { id: string }, never>({
      operation: 'delete',
      query: { id },
    })
  }

  protected async execute<TResponse, TQuery = unknown, TData = unknown>(
    request: RepositoryRequest<TQuery, TData>,
  ): Promise<TResponse> {
    this.lastRequest = request as RepositoryRequest<unknown, unknown>
    return this.nextResponse as TResponse
  }
}

interface FetchCall {
  url: string
  init?: RequestInit
}

type FetchHandler = (url: string, init?: RequestInit) => Promise<Response>

const tests: Array<{ name: string; run: () => Promise<void> | void }> = []

function test(name: string, run: () => Promise<void> | void): void {
  tests.push({ name, run })
}

function customerTestRepo(): TestRepository {
  return new TestRepository({
    fieldMap: { ...customerFieldMap },
    primaryKey: 'customerId',
  })
}

// Customers is the real, in-scope contract for the GSheet transport tests; column
// order (1st key = column A) gives CustomerID=B, CustomerName=D, Line=J,
// CustomerType=M — the letters the GViz assertions below expect.
function customerSheetRepo(
  transformer?: RepositoryTransformer,
  target = 'Customers',
): GSheetRepository<typeof customerContract> {
  return new GSheetRepository({
    contract: customerContract,
    sheetName: 'Customers',
    target,
    spreadsheetId: 'TEST_SPREADSHEET_ID',
    scriptUrl: 'TEST_SCRIPT_URL',
    transformer,
  })
}

const portalRowSchema = z.object({
  invoiceNumber: z.string(),
  issuedDate: z.string(),
  customer: z.object({ customerName: z.string() }),
  items: z.array(z.object({ description: z.string() })),
})

const portalContract = {
  api: {
    query: { list: z.object({}) },
    response: { list: portalRowSchema },
  },
  db: {
    row: portalRowSchema,
    fieldMap: {},
    primaryKey: 'invoiceNumber',
    request: {},
    response: { read: portalRowSchema.partial() },
  },
} satisfies ModuleContract

function portalSheetRepo(): GSheetRepository<typeof portalContract> {
  return new GSheetRepository({
    contract: portalContract,
    sheetName: 'InvoicesView',
    spreadsheetId: 'TEST_SPREADSHEET_ID',
    scriptUrl: 'TEST_SCRIPT_URL',
    decodeJsonCells: true,
  })
}

function gvizBody(table: unknown): string {
  return `google.visualization.Query.setResponse(${JSON.stringify({
    status: 'ok',
    table,
  })});`
}

function response(input: { text?: string; json?: unknown; ok?: boolean; statusText?: string }): Response {
  return {
    ok: input.ok ?? true,
    status: input.ok === false ? 500 : 200,
    statusText: input.statusText ?? 'OK',
    text: async () => input.text ?? '',
    json: async () => input.json,
  } as Response
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

function tqFrom(url: string): string {
  return new URL(url).searchParams.get('tq') ?? ''
}

// ── BaseRepository pipeline (storage-agnostic; unchanged by the contract refactor) ──

test('BaseRepository folds semantic read id into mapped primary-key where', async () => {
  const repo = customerTestRepo()

  await repo.read({ id: 'C001' })

  assert.deepEqual(repo.lastRequest, {
    operation: 'read',
    query: { where: { CustomerID: 'C001' } },
    data: undefined,
  })
})

test('BaseRepository ignores blank read id instead of losing the filter silently', async () => {
  const repo = customerTestRepo()

  await repo.read({ id: '   ' })

  assert.deepEqual(repo.lastRequest, {
    operation: 'read',
    query: {},
    data: undefined,
  })
})

test('BaseRepository maps where select search sort and leaves pagination untouched', async () => {
  const repo = customerTestRepo()

  await repo.read({
    where: {
      customerType: 'Member',
      deletedAt: null,
    },
    select: ['customerId', 'lineId'],
    search: {
      keyword: 'somchai',
      fields: ['customerName', 'address'],
    },
    sort: {
      field: 'customerIndex',
      order: 'asc',
    },
    pagination: {
      page: 2,
      perPage: 50,
    },
  })

  assert.deepEqual(repo.lastRequest, {
    operation: 'read',
    query: {
      where: {
        CustomerType: 'Member',
        DeletedAt: null,
      },
      select: ['CustomerID', 'Line'],
      search: {
        keyword: 'somchai',
        fields: ['CustomerName', 'Address'],
      },
      sort: {
        field: 'CustomerIndex',
        order: 'asc',
      },
      pagination: {
        page: 2,
        perPage: 50,
      },
    },
    data: undefined,
  })
})

test('BaseRepository lets id win over explicit where primary key', async () => {
  const repo = customerTestRepo()

  await repo.read({
    id: 'C001',
    where: {
      customerId: 'WRONG',
    },
  })

  assert.deepEqual(repo.lastRequest?.query, {
    where: {
      CustomerID: 'C001',
    },
  })
})

test('BaseRepository maps create and update data to DB fields', async () => {
  const repo = customerTestRepo()

  await repo.create({
    customerName: 'Alice',
    lineId: 'line-1',
  })

  assert.deepEqual(repo.lastRequest, {
    operation: 'create',
    query: undefined,
    data: {
      CustomerName: 'Alice',
      Line: 'line-1',
    },
  })

  await repo.update('C001', {
    customerName: 'Alice Updated',
    lineId: 'line-2',
  })

  assert.deepEqual(repo.lastRequest, {
    operation: 'update',
    query: {
      where: {
        CustomerID: 'C001',
      },
    },
    data: {
      CustomerName: 'Alice Updated',
      Line: 'line-2',
    },
  })
})

test('BaseRepository requires non-empty id for update and delete', async () => {
  const repo = customerTestRepo()

  await assert.rejects(
    () => repo.update('', { customerName: 'Alice' }),
    /Repository update requires a non-empty id/,
  )
  await assert.rejects(
    () => repo.delete('   '),
    /Repository delete requires a non-empty id/,
  )
})

test('BaseRepository maps object and array responses back to API fields', async () => {
  const repo = customerTestRepo()
  repo.nextResponse = {
    CustomerID: 'C001',
    CustomerName: 'Alice',
    Line: 'line-1',
  }

  assert.deepEqual(await repo.create({}), {
    customerId: 'C001',
    customerName: 'Alice',
    lineId: 'line-1',
  })

  repo.nextResponse = [
    {
      CustomerID: 'C001',
      CustomerName: 'Alice',
      Line: 'line-1',
    },
  ]

  assert.deepEqual(await repo.read(), [
    {
      customerId: 'C001',
      customerName: 'Alice',
      lineId: 'line-1',
    },
  ])
})

test('BaseRepository transformer sees DB fields between mapper.toDb and execute', async () => {
  const repo = new TestRepository({
    primaryKey: 'id',
    fieldMap: {
      Price: 'price',
      Quantity: 'quantity',
      Total: 'total',
    },
    transformer: {
      request(request) {
        assert.deepEqual(request.data, {
          Price: 10,
          Quantity: 2,
        })
        return {
          ...request,
          data: {
            ...(request.data as AnyRow),
            Total: 20,
          },
        }
      },
      response(_response, context) {
        assert.deepEqual(context.request.data, {
          Price: 10,
          Quantity: 2,
          Total: 20,
        })
        return {
          Total: 20,
        }
      },
    },
  })

  repo.nextResponse = {
    Price: 10,
    Quantity: 2,
  }

  assert.deepEqual(await repo.create({ price: 10, quantity: 2 }), {
    total: 20,
  })
  assert.deepEqual(repo.lastRequest?.data, {
    Price: 10,
    Quantity: 2,
    Total: 20,
  })
})

// ── GSheetRepository: contract-driven construction + Google Sheets transport ──

test('GSheetRepository read builds GViz query from mapped API fields', async () => {
  const repo = customerSheetRepo()

  await withMockFetch(
    async () => response({ text: gvizBody({ cols: [], rows: [] }) }),
    async (calls) => {
      await repo.read({
        select: ['customerId'],
        where: {
          customerType: 'Member',
        },
      })

      // customerId -> CustomerID (column B); customerType -> CustomerType (column M)
      assert.equal(tqFrom(calls[0].url), "select B\nwhere M = 'Member'")
    },
  )
})

test('GSheetRepository read requires an explicit spreadsheetId config before fetch', async () => {
  const repo = new GSheetRepository({
    contract: customerContract,
    sheetName: 'Customers',
    scriptUrl: 'TEST_SCRIPT_URL',
  })

  await withMockFetch(
    async () => {
      assert.fail('fetch must not be called without spreadsheetId config')
      return response({ text: '' })
    },
    async (calls) => {
      await assert.rejects(
        () => repo.read(),
        /reads require a spreadsheetId environment variable name/,
      )
      assert.equal(calls.length, 0)
    },
  )
})

test('GSheetRepository read requires the configured spreadsheetId env value before fetch', async () => {
  const missingEnvKey = 'TEST_MISSING_SPREADSHEET_ID'
  delete process.env[missingEnvKey]
  const repo = new GSheetRepository({
    contract: customerContract,
    sheetName: 'Customers',
    spreadsheetId: missingEnvKey,
    scriptUrl: 'TEST_SCRIPT_URL',
  })

  await withMockFetch(
    async () => {
      assert.fail('fetch must not be called when the spreadsheetId env value is missing')
      return response({ text: '' })
    },
    async (calls) => {
      await assert.rejects(
        () => repo.read(),
        new RegExp(`Missing required environment variable: ${missingEnvKey}`),
      )
      assert.equal(calls.length, 0)
    },
  )
})

test('GSheetRepository maps GViz table columns to API fields including Line -> lineId', async () => {
  const repo = customerSheetRepo()

  await withMockFetch(
    async () =>
      response({
        text: gvizBody({
          cols: [{ id: 'B' }, { id: 'D' }, { id: 'J' }],
          rows: [
            {
              c: [{ v: 'C001' }, { v: 'Alice' }, { v: 'line-1' }],
            },
          ],
        }),
      }),
    async () => {
      // B -> CustomerID -> customerId; D -> CustomerName -> customerName; J -> Line -> lineId
      assert.deepEqual(await repo.read(), [
        {
          customerId: 'C001',
          customerName: 'Alice',
          lineId: 'line-1',
        },
      ])
    },
  )
})

test('GSheetRepository throws when GViz returns an unknown column letter', async () => {
  const repo = customerSheetRepo()

  await withMockFetch(
    async () =>
      response({
        text: gvizBody({
          cols: [{ id: 'ZZ' }],
          rows: [{ c: [{ v: 'value' }] }],
        }),
      }),
    async () => {
      await assert.rejects(
        () => repo.read(),
        /No DB field resolves for GViz column 'ZZ'/,
      )
    },
  )
})

test('GSheetRepository portal mode decodes JSON cells without changing scalar values', async () => {
  const repo = portalSheetRepo()

  await withMockFetch(
    async () =>
      response({
        text: gvizBody({
          cols: [{ id: 'A' }, { id: 'B' }, { id: 'C' }, { id: 'D' }],
          rows: [
            {
              c: [
                { v: 'INV-0001' },
                { v: '2026-08-02' },
                { v: '{"customerName":"Magic Wash"}' },
                { v: '[{"description":"Laundry"}]' },
              ],
            },
          ],
        }),
      }),
    async () => {
      assert.deepEqual(await repo.read(), [
        {
          invoiceNumber: 'INV-0001',
          issuedDate: '2026-08-02',
          customer: { customerName: 'Magic Wash' },
          items: [{ description: 'Laundry' }],
        },
      ])
    },
  )
})

test('GSheetRepository portal mode exposes malformed JSON from the sheet', async () => {
  const repo = portalSheetRepo()

  await withMockFetch(
    async () =>
      response({
        text: gvizBody({
          cols: [{ id: 'A' }, { id: 'B' }, { id: 'C' }, { id: 'D' }],
          rows: [
            {
              c: [
                { v: 'INV-0001' },
                { v: '2026-08-02' },
                { v: '{malformed' },
                { v: '[]' },
              ],
            },
          ],
        }),
      }),
    async () => {
      await assert.rejects(() => repo.read(), SyntaxError)
    },
  )
})

test('GSheetRepository create sends a SheetLib APPEND envelope and maps persisted data', async () => {
  const repo = customerSheetRepo(undefined, 'CustomerWriteTarget')

  await withMockFetch(
    async () =>
      response({
        json: {
          status: 'ok',
          target: 'CustomerWriteTarget',
          data: {
            CustomerID: 'C001',
            CustomerName: 'Alice',
            Line: 'line-1',
          },
        },
      }),
    async (calls) => {
      assert.deepEqual(
        await repo.create({
          customerName: 'Alice',
          phone: '0812345678',
          lineId: 'line-1',
          updatedBy: 'tester',
        }),
        {
          customerId: 'C001',
          customerName: 'Alice',
          lineId: 'line-1',
        },
      )

      assert.deepEqual(JSON.parse(calls[0].init?.body as string), {
        resource: 'sheet',
        action: 'APPEND',
        target: 'CustomerWriteTarget',
        data: {
          CustomerName: 'Alice',
          Phone: '0812345678',
          Line: 'line-1',
          UpdatedBy: 'tester',
        },
      })
    },
  )
})

test('GSheetRepository update sends the mapped route id as key_value and a patch-only payload', async () => {
  const repo = customerSheetRepo()

  await withMockFetch(
    async () =>
      response({
        json: {
          status: 'ok',
          target: 'Customers',
          data: {
            CustomerID: 'C001',
            CustomerName: 'Alice Updated',
          },
        },
      }),
    async (calls) => {
      assert.deepEqual(
        await repo.update('C001', {
          customerName: 'Alice Updated',
          updatedBy: 'tester',
        }),
        {
          customerId: 'C001',
          customerName: 'Alice Updated',
        },
      )

      assert.deepEqual(JSON.parse(calls[0].init?.body as string), {
        resource: 'sheet',
        action: 'UPDATE',
        target: 'Customers',
        key_value: 'C001',
        data: {
          CustomerName: 'Alice Updated',
          UpdatedBy: 'tester',
        },
      })
    },
  )
})

test('GSheetRepository forwards the transformer to BaseRepository', async () => {
  // Proves the rewritten constructor still threads `transformer` into super():
  // request() runs on DB-named fields, response() rewrites the stored row.
  const repo = customerSheetRepo({
    request(request) {
      return {
        ...request,
        data: {
          ...(request.data as AnyRow),
          UpdatedBy: 'system',
        },
      }
    },
    response(stored) {
      return {
        ...(stored as AnyRow),
        CustomerName: 'Transformed',
      }
    },
  })

  await withMockFetch(
    async () =>
      response({
        json: {
          status: 'ok',
          target: 'Customers',
          data: {
            CustomerID: 'C001',
            CustomerName: 'Original',
          },
        },
      }),
    async (calls) => {
      const created = await repo.create({
        customerName: 'Alice',
        phone: '0812345678',
        updatedBy: 'tester',
      })

      // request() injected the DB-named UpdatedBy into the APPEND payload
      const sent = JSON.parse(calls[0].init?.body as string) as { data: Record<string, unknown> }
      assert.equal(sent.data.UpdatedBy, 'system')
      // response() override survived back through mapper.toApi (CustomerName -> customerName)
      assert.equal(created.customerName, 'Transformed')
    },
  )
})

test('GSheetRepository write throws SheetLib status errors and delete is future', async () => {
  const repo = customerSheetRepo()

  await withMockFetch(
    async () =>
      response({
        json: {
          status: 'error',
          message: 'bad request',
        },
      }),
    async () => {
      await assert.rejects(
        () =>
          repo.create({
            customerName: 'Alice',
            phone: '0812345678',
            updatedBy: 'tester',
          }),
        /SheetLib APPEND failed: bad request/,
      )
    },
  )

  await assert.rejects(
    () => repo.delete('C001'),
    /GSheetRepository.delete is not implemented yet/,
  )
})

test('GSheetRepository write rejects HTTP failures before parsing a SheetLib response', async () => {
  const repo = customerSheetRepo()

  await withMockFetch(
    async () => response({ ok: false, statusText: 'Bad Gateway' }),
    async () => {
      await assert.rejects(
        () =>
          repo.create({
            customerName: 'Alice',
            phone: '0812345678',
            updatedBy: 'tester',
          }),
        /SheetLib request failed: 500 Bad Gateway/,
      )
    },
  )
})

// ── `read_back_failed`: the write itself succeeded (Values.append/
//    batchUpdate already returned) but SheetLib's own persisted-row
//    read-back failed afterward — see appscript/SheetLib/SheetService.js.
//    This is the exact shape that was previously indistinguishable from a
//    pre-write rejection once MagicwashGateway blanket-caught it. Must
//    always classify as SheetLibTransportError, never SheetLibRejectedError,
//    with the real reason surfaced in the message. ──

test('GSheetRepository create surfaces the real reason for a read_back_failed response as SheetLibTransportError, never Rejected', async () => {
  const repo = customerSheetRepo()

  await withMockFetch(
    async () =>
      response({
        json: {
          status: 'ok',
          target: 'Customers',
          data: null,
          read_back_failed: true,
          reason: 'Sheets read-back failure',
        },
      }),
    async () => {
      await assert.rejects(
        () =>
          repo.create({
            customerName: 'Alice',
            phone: '0812345678',
            updatedBy: 'tester',
          }),
        (error: unknown) => {
          assert.ok(error instanceof SheetLibTransportError)
          assert.ok(!(error instanceof SheetLibRejectedError))
          assert.match(
            error instanceof Error ? error.message : '',
            /succeeded but the persisted-row read-back failed: Sheets read-back failure/,
          )
          return true
        },
      )
    },
  )
})

// ── A confirmed `status: 'ok'` write is not success by itself: `data` must
//    be present and of a usable shape, or this is silent partial
//    persistence — the write happened but nothing tells the caller what got
//    written. Every case below must throw SheetLibTransportError, NEVER
//    SheetLibRejectedError: the gateway did not reject anything. ──

test('GSheetRepository create throws SheetLibTransportError (not Rejected) when the gateway answers ok with no "data" at all', async () => {
  const repo = customerSheetRepo()

  await withMockFetch(
    async () => response({ json: { status: 'ok', target: 'Customers' } }),
    async () => {
      await assert.rejects(
        () =>
          repo.create({
            customerName: 'Alice',
            phone: '0812345678',
            updatedBy: 'tester',
          }),
        (error: unknown) => {
          assert.ok(error instanceof SheetLibTransportError)
          assert.ok(!(error instanceof SheetLibRejectedError))
          assert.match(
            error instanceof Error ? error.message : '',
            /confirmed the write but returned no usable persisted row/,
          )
          return true
        },
      )
    },
  )
})

test('GSheetRepository update throws SheetLibTransportError (not Rejected) when the gateway answers ok with no "data" at all', async () => {
  const repo = customerSheetRepo()

  await withMockFetch(
    async () => response({ json: { status: 'ok', target: 'Customers' } }),
    async () => {
      await assert.rejects(
        () =>
          repo.update('C001', {
            customerName: 'Alice Updated',
            updatedBy: 'tester',
          }),
        (error: unknown) => {
          assert.ok(error instanceof SheetLibTransportError)
          assert.ok(!(error instanceof SheetLibRejectedError))
          assert.match(
            error instanceof Error ? error.message : '',
            /confirmed the write but returned no usable persisted row/,
          )
          return true
        },
      )
    },
  )
})

test('GSheetRepository create throws SheetLibTransportError (not Rejected) when "data" is a non-object (a scalar, not a persisted row)', async () => {
  const repo = customerSheetRepo()

  await withMockFetch(
    async () => response({ json: { status: 'ok', target: 'Customers', data: 'C001' } }),
    async () => {
      await assert.rejects(
        () =>
          repo.create({
            customerName: 'Alice',
            phone: '0812345678',
            updatedBy: 'tester',
          }),
        (error: unknown) => {
          assert.ok(error instanceof SheetLibTransportError)
          assert.ok(!(error instanceof SheetLibRejectedError))
          return true
        },
      )
    },
  )
})

test('GSheetRepository create throws SheetLibTransportError (not Rejected) when "data" is an array on the single-row path', async () => {
  const repo = customerSheetRepo()

  await withMockFetch(
    async () =>
      response({
        json: { status: 'ok', target: 'Customers', data: [{ CustomerID: 'C001' }] },
      }),
    async () => {
      await assert.rejects(
        () =>
          repo.create({
            customerName: 'Alice',
            phone: '0812345678',
            updatedBy: 'tester',
          }),
        (error: unknown) => {
          assert.ok(error instanceof SheetLibTransportError)
          assert.ok(!(error instanceof SheetLibRejectedError))
          return true
        },
      )
    },
  )
})

test('GSheetRepository write requires an explicit target before fetch', async () => {
  const repo = new GSheetRepository({
    contract: customerContract,
    sheetName: 'Customers',
    spreadsheetId: 'TEST_SPREADSHEET_ID',
    scriptUrl: 'TEST_SCRIPT_URL',
  })

  await withMockFetch(
    async () => {
      assert.fail('fetch must not be called without a SheetLib target')
      return response({ json: {} })
    },
    async (calls) => {
      await assert.rejects(
        () =>
          repo.create({
            customerName: 'Alice',
            phone: '0812345678',
            updatedBy: 'tester',
          }),
        /writes require an explicit SheetLib target/,
      )
      assert.equal(calls.length, 0)
    },
  )
})

test('GSheetRepository batchAppend transforms each object while issuing one APPEND request', async () => {
  const requestInputs = [
    { CustomerName: 'Alice', Phone: '0812345678', UpdatedBy: 'tester' },
    { CustomerName: 'Bob', Phone: '0899999999', UpdatedBy: 'tester' },
  ]
  const storedRows = [
    { CustomerID: 'C001', CustomerName: 'Alice' },
    { CustomerID: 'C002', CustomerName: 'Bob' },
  ]
  let requestCalls = 0
  let responseCalls = 0

  const repo = customerSheetRepo({
    request(request) {
      if (Array.isArray(request.data)) {
        throw new Error('request transformer rejects arrays')
      }
      assert.equal(request.operation, 'create')
      assert.deepEqual(request.data, requestInputs[requestCalls])
      requestCalls += 1
      return {
        ...request,
        data: {
          ...(request.data as Record<string, unknown>),
          UpdatedBy: 'batch-system',
        },
      }
    },
    response(stored, context) {
      if (Array.isArray(stored)) {
        throw new Error('response transformer rejects arrays')
      }
      assert.deepEqual(stored, storedRows[responseCalls])
      assert.deepEqual(context.request.data, {
        ...requestInputs[responseCalls],
        UpdatedBy: 'batch-system',
      })
      responseCalls += 1
      return {
        ...(stored as Record<string, unknown>),
        CustomerName: `${(stored as Record<string, unknown>).CustomerName} (transformed)`,
      }
    },
  })

  await withMockFetch(
    async () =>
      response({
        json: {
          status: 'ok',
          target: 'Customers',
          data: [
            { CustomerID: 'C001', CustomerName: 'Alice' },
            { CustomerID: 'C002', CustomerName: 'Bob' },
          ],
        },
      }),
    async (calls) => {
      assert.deepEqual(
        await repo.batchAppend([
          { customerName: 'Alice', phone: '0812345678', updatedBy: 'tester' },
          { customerName: 'Bob', phone: '0899999999', updatedBy: 'tester' },
        ]),
        [
          { customerId: 'C001', customerName: 'Alice (transformed)' },
          { customerId: 'C002', customerName: 'Bob (transformed)' },
        ],
      )

      assert.equal(calls.length, 1)
      assert.equal(requestCalls, 2)
      assert.equal(responseCalls, 2)
      assert.deepEqual(JSON.parse(calls[0].init?.body as string), {
        resource: 'sheet',
        action: 'APPEND',
        target: 'Customers',
        data: [
          { CustomerName: 'Alice', Phone: '0812345678', UpdatedBy: 'batch-system' },
          { CustomerName: 'Bob', Phone: '0899999999', UpdatedBy: 'batch-system' },
        ],
      })
    },
  )
})

// ── Route-id precedence with a conflicting body primary key ──
// The customer update contract does not expose `customerId`, so a synthetic,
// test-only ModuleContract whose update payload carries the primary key is the
// only way to prove the folded route id wins the doPost merge (where pinned last).

const widgetRowSchema = z.object({
  WidgetID: z.string(),
  Name: z.string(),
})

const widgetContract = {
  api: {
    query: {
      list: z.object({
        keyword: z.string().default(''),
        page: z.coerce.number().int().positive().default(1),
        perPage: z.coerce.number().int().positive().default(20),
        sortBy: z.enum(['widgetId']).default('widgetId'),
        sortOrder: z.enum(['asc', 'desc']).default('asc'),
      }),
    },
    request: {
      create: z.object({ name: z.string().min(1) }),
      update: z.object({ widgetId: z.string().optional(), name: z.string().optional() }),
    },
    response: {
      list: z.object({ widgetId: z.string() }),
      detail: z.object({ widgetId: z.string(), name: z.string() }),
      create: z.object({ widgetId: z.string(), name: z.string() }),
      update: z.object({ widgetId: z.string(), name: z.string() }),
    },
  },
  db: {
    row: widgetRowSchema,
    fieldMap: { WidgetID: 'widgetId', Name: 'name' },
    primaryKey: 'widgetId',
    request: {
      create: z.object({ Name: z.string() }),
      update: z.object({ Name: z.string().optional() }),
    },
    response: {
      read: widgetRowSchema.partial(),
      create: widgetRowSchema,
      update: widgetRowSchema,
    },
  },
} satisfies ModuleContract

test('GSheetRepository update lets the route id win over a conflicting body primary key', async () => {
  const repo = new GSheetRepository({
    contract: widgetContract,
    sheetName: 'Widgets',
    target: 'Widget',
    spreadsheetId: 'TEST_SPREADSHEET_ID',
    scriptUrl: 'TEST_SCRIPT_URL',
  })

  await withMockFetch(
    async () =>
      response({
        json: { status: 'ok', target: 'Widget', data: { WidgetID: 'W1', Name: 'New' } },
      }),
    async (calls) => {
      await repo.update('W1', { widgetId: 'WRONG', name: 'New' })

      // The route id becomes key_value and the primary key is omitted from the patch.
      assert.deepEqual(JSON.parse(calls[0].init?.body as string), {
        resource: 'sheet',
        action: 'UPDATE',
        target: 'Widget',
        key_value: 'W1',
        data: {
          Name: 'New',
        },
      })
    },
  )
})

// ── read-only GSheetRepository: write guards fire before any Apps Script fetch ──

const readOnlyRowSchema = z.object({
  id: z.string(),
  label: z.string().nullable(),
})

const readOnlyListQuerySchema = z.object({
  keyword: z.string().default(''),
  page: z.coerce.number().int().positive().default(1),
  perPage: z.coerce.number().int().positive().default(20),
  sortBy: z.enum(['id']).default('id'),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
})

const readOnlyContract = {
  api: {
    query: { list: readOnlyListQuerySchema },
    response: { list: z.object({ id: z.string(), label: z.string().nullable() }) },
  },
  db: {
    row: readOnlyRowSchema,
    fieldMap: { id: 'id', label: 'label' },
    primaryKey: 'id',
    request: {},
    response: { read: readOnlyRowSchema.partial() },
  },
} satisfies ModuleContract

function readOnlySheetRepo(): GSheetRepository<typeof readOnlyContract> {
  return new GSheetRepository({
    contract: readOnlyContract,
    sheetName: 'ReadOnly',
    spreadsheetId: 'TEST_SPREADSHEET_ID',
    scriptUrl: 'TEST_SCRIPT_URL',
  })
}

test('read-only GSheetRepository.create throws before any fetch', async () => {
  const repo = readOnlySheetRepo()

  await withMockFetch(
    async () => {
      assert.fail('fetch must not be called for unsupported create')
      return response({ json: { success: true, data: {} } })
    },
    async (calls) => {
      await assert.rejects(
        () => (repo as unknown as { create: (data: unknown) => Promise<unknown> }).create({ label: 'x' }),
        /create is not supported by this module/,
      )
      assert.equal(calls.length, 0)
    },
  )
})

test('read-only GSheetRepository.update throws before any fetch', async () => {
  const repo = readOnlySheetRepo()

  await withMockFetch(
    async () => {
      assert.fail('fetch must not be called for unsupported update')
      return response({ json: { success: true, data: {} } })
    },
    async (calls) => {
      await assert.rejects(
        () =>
          (repo as unknown as { update: (id: string, data: unknown) => Promise<unknown> }).update(
            'id-1',
            { label: 'x' },
          ),
        /update is not supported by this module/,
      )
      assert.equal(calls.length, 0)
    },
  )
})

// ── z.never() declares "must never be written" as intent, rather than
//    protecting by omission — but it must gate create()/update()/batchAppend()
//    identically to an absent request slot. Proves the equivalence directly,
//    the same representation Payment/InvoicesView/OrdersView now use. ──

const neverWriteContract = {
  api: {
    query: { list: readOnlyListQuerySchema },
    response: { list: z.object({ id: z.string(), label: z.string().nullable() }) },
  },
  db: {
    row: readOnlyRowSchema,
    fieldMap: { id: 'id', label: 'label' },
    primaryKey: 'id',
    request: { create: z.never(), update: z.never() },
    response: { read: readOnlyRowSchema.partial() },
  },
} satisfies ModuleContract

function neverWriteSheetRepo(): GSheetRepository<typeof neverWriteContract> {
  return new GSheetRepository({
    contract: neverWriteContract,
    sheetName: 'NeverWrite',
    spreadsheetId: 'TEST_SPREADSHEET_ID',
    scriptUrl: 'TEST_SCRIPT_URL',
  })
}

test('GSheetRepository.create declared unsupported via z.never() throws before any fetch, same as an absent slot', async () => {
  const repo = neverWriteSheetRepo()

  await withMockFetch(
    async () => {
      assert.fail('fetch must not be called for a z.never() create slot')
      return response({ json: {} })
    },
    async (calls) => {
      await assert.rejects(
        () => (repo as unknown as { create: (data: unknown) => Promise<unknown> }).create({ label: 'x' }),
        /create is not supported by this module/,
      )
      assert.equal(calls.length, 0)
    },
  )
})

test('GSheetRepository.update declared unsupported via z.never() throws before any fetch, same as an absent slot', async () => {
  const repo = neverWriteSheetRepo()

  await withMockFetch(
    async () => {
      assert.fail('fetch must not be called for a z.never() update slot')
      return response({ json: {} })
    },
    async (calls) => {
      await assert.rejects(
        () =>
          (repo as unknown as { update: (id: string, data: unknown) => Promise<unknown> }).update(
            'id-1',
            { label: 'x' },
          ),
        /update is not supported by this module/,
      )
      assert.equal(calls.length, 0)
    },
  )
})

test('GSheetRepository.batchAppend declared unsupported via z.never() throws before any fetch', async () => {
  const repo = neverWriteSheetRepo()

  await withMockFetch(
    async () => {
      assert.fail('fetch must not be called for a z.never() create slot')
      return response({ json: {} })
    },
    async (calls) => {
      await assert.rejects(
        () => repo.batchAppend([{ label: 'x' } as never]),
        /batchAppend is not supported by this module/,
      )
      assert.equal(calls.length, 0)
    },
  )
})

async function main(): Promise<void> {
  for (const item of tests) {
    await item.run()
  }
  console.log(`${tests.length} repository dry tests passed`)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
