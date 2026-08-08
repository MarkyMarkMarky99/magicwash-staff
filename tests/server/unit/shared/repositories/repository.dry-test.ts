import assert from 'node:assert/strict'
import {
  BaseRepository,
  Mapper,
  type FieldMap,
  type RepositoryRequest,
  type RepositoryTransformer,
} from '../../../../../server/shared/repositories/base.repository.js'
import type { ReadQueryDTO } from '../../../../../server/shared/dtos/read-query.dto.js'

type AnyRow = Record<string, unknown>

const customerFieldMap: FieldMap = {
  CustomerID: 'customerId',
  CustomerName: 'customerName',
  Line: 'lineId',
  CustomerType: 'customerType',
  DeletedAt: 'deletedAt',
  CustomerIndex: 'customerIndex',
  Address: 'address',
}

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

const tests: Array<{ name: string; run: () => Promise<void> | void }> = []

function test(name: string, run: () => Promise<void> | void): void {
  tests.push({ name, run })
}

function customerTestRepo(): TestRepository {
  return new TestRepository({
    fieldMap: customerFieldMap,
    primaryKey: 'customerId',
  })
}

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
    where: { customerId: 'WRONG' },
  })

  assert.deepEqual(repo.lastRequest?.query, {
    where: { CustomerID: 'C001' },
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
      where: { CustomerID: 'C001' },
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
        return { Total: 20 }
      },
    },
  })

  repo.nextResponse = { Price: 10, Quantity: 2 }

  assert.deepEqual(await repo.create({ price: 10, quantity: 2 }), {
    total: 20,
  })
  assert.deepEqual(repo.lastRequest?.data, {
    Price: 10,
    Quantity: 2,
    Total: 20,
  })
})

test('Mapper rejects a non-bijective field map', () => {
  assert.throws(
    () => new Mapper({ FirstColumn: 'value', SecondColumn: 'value' }),
    /Field map is not bijective: DB columns 'FirstColumn' and 'SecondColumn' both map to API field 'value'/,
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
