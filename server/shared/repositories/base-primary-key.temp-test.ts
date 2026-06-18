import assert from 'node:assert/strict'
import {
  BaseRepository,
  type FieldMap,
  type RepositoryReadQuery,
  type RepositoryRequest,
} from './base.repository'

type CustomerApiRow = {
  customerId: string
  customerName: string
  customerType?: string
}

type CustomerReadWhere = {
  customerId?: string
  customerType?: string
}

type CustomerCreate = {
  customerId: string
  customerName: string
}

type CustomerUpdate = {
  customerName?: string
}

class FakeRepository extends BaseRepository<
  CustomerApiRow,
  CustomerReadWhere,
  CustomerCreate,
  CustomerUpdate
> {
  lastExecuteRequest: RepositoryRequest | null = null

  constructor(input: { fieldMap?: FieldMap; primaryKey: keyof CustomerReadWhere & string }) {
    super(input)
  }

  protected async execute<TResponse>(request: RepositoryRequest): Promise<TResponse> {
    this.lastExecuteRequest = request
    return { CustomerID: 'C001', CustomerName: 'Somchai' } as TResponse
  }

  read(query?: RepositoryReadQuery<CustomerReadWhere>): Promise<Array<Partial<CustomerApiRow>>> {
    return this.request({ operation: 'read', query })
  }

  create(data: CustomerCreate): Promise<CustomerApiRow> {
    return this.request({ operation: 'create', data })
  }

  update(id: string, data: CustomerUpdate): Promise<CustomerApiRow> {
    return this.request({ operation: 'update', query: { id }, data })
  }

  // Routed through request() so the central id validation is exercised.
  delete(id: string): Promise<unknown> {
    return this.request({ operation: 'delete', query: { id } })
  }
}

const customerFieldMap: FieldMap = {
  CustomerID: 'customerId',
  CustomerName: 'customerName',
  CustomerType: 'customerType',
}

async function run(): Promise<void> {
  const repo = new FakeRepository({
    primaryKey: 'customerId',
    fieldMap: customerFieldMap,
  })

  // Read through a call expression so assert's `asserts actual is T` overloads
  // don't persistently narrow the captured request across assertions.
  const lastRequest = (): RepositoryRequest | null => repo.lastExecuteRequest

  await repo.read({
    id: 'C001',
    select: ['customerId', 'customerName'],
    search: {
      keyword: 'somchai',
      fields: ['customerName'],
    },
    sort: {
      field: 'customerId',
      order: 'asc',
    },
    pagination: {
      page: 1,
      perPage: 50,
    },
  })

  assert.deepEqual(lastRequest(), {
    operation: 'read',
    query: {
      where: {
        CustomerID: 'C001',
      },
      select: ['CustomerID', 'CustomerName'],
      search: {
        keyword: 'somchai',
        fields: ['CustomerName'],
      },
      sort: {
        field: 'CustomerID',
        order: 'asc',
      },
      pagination: {
        page: 1,
        perPage: 50,
      },
    },
    data: undefined,
  })

  const updated = await repo.update('C001', {
    customerName: 'New Name',
  })

  assert.deepEqual(lastRequest(), {
    operation: 'update',
    query: {
      where: {
        CustomerID: 'C001',
      },
    },
    data: {
      CustomerName: 'New Name',
    },
  })

  assert.deepEqual(updated, {
    customerId: 'C001',
    customerName: 'Somchai',
  })

  // id must never survive into the execute() request.
  const afterUpdate = lastRequest()
  assert.ok(
    afterUpdate?.query &&
      !('id' in (afterUpdate.query as Record<string, unknown>)),
    'execute() request must not carry an id key',
  )

  // read with a blank id ignores it: no primaryKey filter is added.
  repo.lastExecuteRequest = null
  await repo.read({ id: '' })
  assert.deepEqual(lastRequest(), {
    operation: 'read',
    query: {},
    data: undefined,
  })

  // read with a non-empty id folds into where with the mapped DB column.
  await repo.read({ id: 'C001' })
  assert.deepEqual(lastRequest(), {
    operation: 'read',
    query: {
      where: {
        CustomerID: 'C001',
      },
    },
    data: undefined,
  })

  // update/delete require a non-empty id, before any execute() call.
  repo.lastExecuteRequest = null
  await assert.rejects(() => repo.update('', { customerName: 'New Name' }), {
    message: 'Repository update requires a non-empty id',
  })
  await assert.rejects(() => repo.update('   ', { customerName: 'New Name' }), {
    message: 'Repository update requires a non-empty id',
  })
  await assert.rejects(() => repo.delete(''), {
    message: 'Repository delete requires a non-empty id',
  })
  assert.equal(lastRequest(), null, 'a blank id must not reach execute()')

  console.log('base primaryKey/id temp tests passed')
}

run().catch((error: unknown) => {
  console.error(error)
  process.exit(1)
})
