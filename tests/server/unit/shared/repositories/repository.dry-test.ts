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
function customerSheetRepo(transformer?: RepositoryTransformer): GSheetRepository<typeof customerContract> {
  return new GSheetRepository({
    contract: customerContract,
    sheetName: 'Customers',
    spreadsheetId: 'spreadsheet-id',
    scriptUrl: 'https://script.example/exec',
    transformer,
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

test('GSheetRepository create sends Apps Script append payload and maps response', async () => {
  const repo = customerSheetRepo()

  await withMockFetch(
    async () =>
      response({
        json: {
          success: true,
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
        action: 'APPEND',
        sheet: 'Customers',
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

test('GSheetRepository update folds the route id into the doPost payload', async () => {
  const repo = customerSheetRepo()

  await withMockFetch(
    async () =>
      response({
        json: {
          success: true,
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
        action: 'UPDATE',
        sheet: 'Customers',
        data: {
          CustomerName: 'Alice Updated',
          UpdatedBy: 'tester',
          CustomerID: 'C001',
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
          success: true,
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

test('GSheetRepository write throws Apps Script errors and delete is future', async () => {
  const repo = customerSheetRepo()

  await withMockFetch(
    async () =>
      response({
        json: {
          success: false,
          error: 'bad request',
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
        /Apps Script APPEND failed: bad request/,
      )
    },
  )

  await assert.rejects(
    () => repo.delete('C001'),
    /GSheetRepository.delete is not implemented yet/,
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
    spreadsheetId: 'spreadsheet-id',
    scriptUrl: 'https://script.example/exec',
  })

  await withMockFetch(
    async () =>
      response({
        json: { success: true, data: { WidgetID: 'W1', Name: 'New' } },
      }),
    async (calls) => {
      await repo.update('W1', { widgetId: 'WRONG', name: 'New' })

      // data has WidgetID:'WRONG' from the body, but where (id) is pinned last
      assert.deepEqual(JSON.parse(calls[0].init?.body as string), {
        action: 'UPDATE',
        sheet: 'Widgets',
        data: {
          Name: 'New',
          WidgetID: 'W1',
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
    spreadsheetId: 'spreadsheet-id',
    scriptUrl: 'https://script.example/exec',
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
