import assert from 'node:assert/strict'
import { z } from 'zod'
import { API_ERROR_CODES } from '../../../../../contracts/shared/api.schema.js'
import { ReadQueryDTO } from '../../../../../server/shared/dtos/read-query.dto.js'
import { ApiError } from '../../../../../server/shared/http/api-error.js'

type AnyRow = Record<string, unknown>
type BaseCrudServiceCtor = new (input: Record<string, unknown>) => {
  list(query: unknown): Promise<unknown>
  getById(id: string): Promise<unknown>
  create(payload: unknown): Promise<unknown>
  update(id: string, payload: unknown): Promise<unknown>
}

interface RepoUpdateCall {
  id: string
  data: unknown
}

class FakeRepository {
  readCalls: unknown[] = []
  createCalls: unknown[] = []
  updateCalls: RepoUpdateCall[] = []
  nextReadResponse: Array<Partial<AnyRow>> = []
  nextCreateResponse: AnyRow = {}
  nextUpdateResponse: AnyRow = {}
  readError?: Error
  createError?: Error
  updateError?: Error

  async read(query?: unknown): Promise<Array<Partial<AnyRow>>> {
    this.readCalls.push(query)
    if (this.readError) {
      throw this.readError
    }
    return this.nextReadResponse
  }

  async create(data: unknown): Promise<AnyRow> {
    this.createCalls.push(data)
    if (this.createError) {
      throw this.createError
    }
    return this.nextCreateResponse
  }

  async update(id: string, data: unknown): Promise<AnyRow> {
    this.updateCalls.push({ id, data })
    if (this.updateError) {
      throw this.updateError
    }
    return this.nextUpdateResponse
  }
}

const listQuerySchema = z.object({
  keyword: z.string().default(''),
  customerType: z.enum(['Member', 'Regular']).nullable().optional().default(null),
  page: z.coerce.number().int().positive().default(1),
  perPage: z.coerce.number().int().positive().default(20),
  sortBy: z.enum(['customerIndex', 'registeredDate']).default('customerIndex'),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
})

const createSchema = z.object({
  customerName: z.string().min(1),
  phone: z.string().nullish(),
  updatedBy: z.string().min(1),
})

const updateSchema = z
  .object({
    customerName: z.string().min(1).optional(),
    phone: z.string().nullable().optional(),
    updatedBy: z.string().min(1),
  })
  .refine(
    (data) => Object.entries(data).some(([key, value]) => key !== 'updatedBy' && value !== undefined),
    { message: 'At least one updatable field is required' },
  )

const listResponseSchema = z.object({
  customerId: z.string(),
  customerName: z.string(),
})

const detailResponseSchema = listResponseSchema.extend({
  phone: z.string().nullable(),
})

const createResponseSchema = detailResponseSchema.pick({
  customerId: true,
  customerName: true,
})

const updateResponseSchema = detailResponseSchema.pick({
  customerId: true,
  phone: true,
})

type ListQuery = z.infer<typeof listQuerySchema>

const tests: Array<{ name: string; run: () => Promise<void> | void }> = []

function test(name: string, run: () => Promise<void> | void): void {
  tests.push({ name, run })
}

// The service now builds the read query via ReadQueryDTO.fromQuery: reserved
// fields become search/sort/pagination, every other field (customerType) becomes
// `where`, and null is preserved (the repository decides what to ignore).
function expectedReadQuery(query: ListQuery): ReadQueryDTO<unknown> {
  return ReadQueryDTO.fromQuery(query, ['customerName'])
}

async function loadServiceCtor(): Promise<BaseCrudServiceCtor> {
  // Keep this dry test type-checkable before BaseCrudService is implemented.
  const modulePath = '../../../../../server/shared/services/base-crud.service.js'
  const module = (await import(modulePath)) as { BaseCrudService: BaseCrudServiceCtor }
  return module.BaseCrudService
}

function makeService(BaseCrudService: BaseCrudServiceCtor, repo = new FakeRepository()) {
  const service = new BaseCrudService({
    repository: repo,
    api: {
      query: { list: listQuerySchema },
      request: { create: createSchema, update: updateSchema },
      response: {
        list: listResponseSchema,
        detail: detailResponseSchema,
        create: createResponseSchema,
        update: updateResponseSchema,
      },
    },
    searchFields: ['customerName'],
  })

  return { service, repo }
}

async function expectApiError(
  action: () => Promise<unknown>,
  code: string,
  status: number,
): Promise<ApiError> {
  try {
    await action()
  } catch (error) {
    assert.ok(error instanceof ApiError)
    assert.equal(error.code, code)
    assert.equal(error.status, status)
    return error
  }
  assert.fail(`Expected ApiError ${code}`)
}

test('list applies query defaults and forwards read query DTO', async () => {
  const BaseCrudService = await loadServiceCtor()
  const { service, repo } = makeService(BaseCrudService)

  repo.nextReadResponse = []

  assert.deepEqual(await service.list({}), {
    items: [],
    pagination: {
      page: 1,
      perPage: 20,
    },
  })
  assert.deepEqual(repo.readCalls, [
    expectedReadQuery({
      keyword: '',
      customerType: null,
      page: 1,
      perPage: 20,
      sortBy: 'customerIndex',
      sortOrder: 'asc',
    }),
  ])
})

test('repository factory stays lazy until a request method is called', async () => {
  const BaseCrudService = await loadServiceCtor()
  const repo = new FakeRepository()
  let factoryCalls = 0
  const service = new BaseCrudService({
    repository: () => {
      factoryCalls += 1
      return repo
    },
    api: {
      query: { list: listQuerySchema },
      request: { create: createSchema, update: updateSchema },
      response: {
        list: listResponseSchema,
        detail: detailResponseSchema,
        create: createResponseSchema,
        update: updateResponseSchema,
      },
    },
    searchFields: ['customerName'],
  })

  assert.equal(factoryCalls, 0)

  await service.list({})

  assert.equal(factoryCalls, 1)
})

test('list coerces HTTP query strings before returning pagination', async () => {
  const BaseCrudService = await loadServiceCtor()
  const { service, repo } = makeService(BaseCrudService)

  repo.nextReadResponse = []

  assert.deepEqual(await service.list({ page: '2', perPage: '5' }), {
    items: [],
    pagination: {
      page: 2,
      perPage: 5,
    },
  })
  assert.deepEqual(repo.readCalls, [
    expectedReadQuery({
      keyword: '',
      customerType: null,
      page: 2,
      perPage: 5,
      sortBy: 'customerIndex',
      sortOrder: 'asc',
    }),
  ])
})

test('list throws validation error for invalid query and does not call repo', async () => {
  const BaseCrudService = await loadServiceCtor()
  const { service, repo } = makeService(BaseCrudService)

  await expectApiError(
    () => service.list({ page: '0' }),
    API_ERROR_CODES.VALIDATION_ERROR,
    422,
  )
  assert.equal(repo.readCalls.length, 0)
})

test('list projects fields without validating values', async () => {
  const BaseCrudService = await loadServiceCtor()
  const { service, repo } = makeService(BaseCrudService)
  const rawRow = {
    customerId: 'C001',
    customerName: 123,
    phone: 812345678,
    updatedAt: 'audit',
  }
  repo.nextReadResponse = [rawRow]

  assert.deepEqual(await service.list({ page: 2, perPage: 5 }), {
    items: [
      {
        customerId: 'C001',
        customerName: 123,
      },
    ],
    pagination: {
      page: 2,
      perPage: 5,
    },
  })
  assert.deepEqual(rawRow, {
    customerId: 'C001',
    customerName: 123,
    phone: 812345678,
    updatedAt: 'audit',
  })
})

test('list projects multiple rows independently', async () => {
  const BaseCrudService = await loadServiceCtor()
  const { service, repo } = makeService(BaseCrudService)
  repo.nextReadResponse = [
    { customerId: 'C001', customerName: 'Alice', phone: '0812345678' },
    { customerId: 'C002', customerName: 123, updatedAt: 'audit' },
  ]

  assert.deepEqual(await service.list({}), {
    items: [
      { customerId: 'C001', customerName: 'Alice' },
      { customerId: 'C002', customerName: 123 },
    ],
    pagination: {
      page: 1,
      perPage: 20,
    },
  })
})

test('list returns all repository rows', async () => {
  const BaseCrudService = await loadServiceCtor()
  const { service, repo } = makeService(BaseCrudService)
  repo.nextReadResponse = [
    { customerId: 'C001', customerName: 'Alice' },
    { customerId: 'C002', customerName: 'Bob' },
    { customerId: 'C003', customerName: 'Cathy' },
  ]

  assert.deepEqual(await service.list({ page: 1, perPage: 1 }), {
    items: [
      { customerId: 'C001', customerName: 'Alice' },
      { customerId: 'C002', customerName: 'Bob' },
      { customerId: 'C003', customerName: 'Cathy' },
    ],
    pagination: {
      page: 1,
      perPage: 1,
    },
  })
})

test('list projects missing response fields as undefined keys', async () => {
  const BaseCrudService = await loadServiceCtor()
  const { service, repo } = makeService(BaseCrudService)
  repo.nextReadResponse = [{ customerId: 'C001' }]

  assert.deepEqual(await service.list({}), {
    items: [
      {
        customerId: 'C001',
        customerName: undefined,
      },
    ],
    pagination: {
      page: 1,
      perPage: 20,
    },
  })
})

test('list projection does not mutate repository row objects', async () => {
  const BaseCrudService = await loadServiceCtor()
  const { service, repo } = makeService(BaseCrudService)
  const rawRow = {
    customerId: 'C001',
    customerName: 'Alice',
    phone: '0812345678',
  }
  repo.nextReadResponse = [rawRow]

  await service.list({})

  assert.deepEqual(rawRow, {
    customerId: 'C001',
    customerName: 'Alice',
    phone: '0812345678',
  })
})

test('list propagates repository errors', async () => {
  const BaseCrudService = await loadServiceCtor()
  const { service, repo } = makeService(BaseCrudService)
  repo.readError = new Error('read failed')

  await assert.rejects(() => service.list({}), /read failed/)
})

test('getById rejects blank id with 400 before calling repo', async () => {
  const BaseCrudService = await loadServiceCtor()
  const { service, repo } = makeService(BaseCrudService)

  await expectApiError(() => service.getById('  '), API_ERROR_CODES.BAD_REQUEST, 400)
  assert.equal(repo.readCalls.length, 0)
})

test('getById reads by semantic id and returns projected detail row', async () => {
  const BaseCrudService = await loadServiceCtor()
  const { service, repo } = makeService(BaseCrudService)
  const rawRow = {
    customerId: 'C001',
    customerName: 'Alice',
    phone: 812345678,
    updatedBy: 'system',
  }
  repo.nextReadResponse = [
    rawRow,
  ]

  assert.deepEqual(await service.getById('C001'), {
    customerId: 'C001',
    customerName: 'Alice',
    phone: 812345678,
  })
  assert.deepEqual(repo.readCalls, [ReadQueryDTO.fromId('C001')])
  assert.deepEqual(rawRow, {
    customerId: 'C001',
    customerName: 'Alice',
    phone: 812345678,
    updatedBy: 'system',
  })
})

test('getById trims id before reading', async () => {
  const BaseCrudService = await loadServiceCtor()
  const { service, repo } = makeService(BaseCrudService)
  repo.nextReadResponse = [
    {
      customerId: 'C001',
      customerName: 'Alice',
      phone: null,
    },
  ]

  assert.deepEqual(await service.getById('  C001  '), {
    customerId: 'C001',
    customerName: 'Alice',
    phone: null,
  })
  assert.deepEqual(repo.readCalls, [ReadQueryDTO.fromId('C001')])
})

test('getById projects missing response fields as undefined keys', async () => {
  const BaseCrudService = await loadServiceCtor()
  const { service, repo } = makeService(BaseCrudService)
  repo.nextReadResponse = [
    {
      customerId: 'C001',
    },
  ]

  assert.deepEqual(await service.getById('C001'), {
    customerId: 'C001',
    customerName: undefined,
    phone: undefined,
  })
})

test('getById throws 404 for missing row', async () => {
  const BaseCrudService = await loadServiceCtor()
  const missing = makeService(BaseCrudService)
  missing.repo.nextReadResponse = []

  await expectApiError(
    () => missing.service.getById('C404'),
    API_ERROR_CODES.NOT_FOUND,
    404,
  )
})

test('getById throws 409 for duplicate rows', async () => {
  const BaseCrudService = await loadServiceCtor()
  const duplicate = makeService(BaseCrudService)
  duplicate.repo.nextReadResponse = [{ customerId: 'C001' }, { customerId: 'C001' }]

  await expectApiError(
    () => duplicate.service.getById('C001'),
    API_ERROR_CODES.CONFLICT,
    409,
  )
})

test('getById propagates repository errors', async () => {
  const BaseCrudService = await loadServiceCtor()
  const { service, repo } = makeService(BaseCrudService)
  repo.readError = new Error('read failed')

  await assert.rejects(() => service.getById('C001'), /read failed/)
})

test('create omits absent nullish fields and projects create response', async () => {
  const BaseCrudService = await loadServiceCtor()
  const { service, repo } = makeService(BaseCrudService)
  const rawResponse = {
    customerId: 'C001',
    customerName: 123,
    phone: '0812345678',
    updatedAt: 'audit',
  }
  repo.nextCreateResponse = rawResponse

  assert.deepEqual(
    await service.create({
      customerName: 'Alice',
      updatedBy: 'tester',
      hackerField: 'strip-me',
    }),
    {
      customerId: 'C001',
      customerName: 123,
    },
  )
  assert.deepEqual(repo.createCalls, [
    {
      customerName: 'Alice',
      updatedBy: 'tester',
    },
  ])
  assert.ok(!('phone' in (repo.createCalls[0] as AnyRow)))
  assert.ok(!('hackerField' in (repo.createCalls[0] as AnyRow)))
  assert.deepEqual(rawResponse, {
    customerId: 'C001',
    customerName: 123,
    phone: '0812345678',
    updatedAt: 'audit',
  })
})

test('create preserves explicit null for nullish fields', async () => {
  const BaseCrudService = await loadServiceCtor()
  const { service, repo } = makeService(BaseCrudService)
  repo.nextCreateResponse = {
    customerId: 'C001',
    customerName: 'Alice',
  }

  await service.create({
    customerName: 'Alice',
    phone: null,
    updatedBy: 'tester',
  })

  assert.deepEqual(repo.createCalls, [
    {
      customerName: 'Alice',
      phone: null,
      updatedBy: 'tester',
    },
  ])
})

test('create throws validation error and never sends raw invalid payload to repo', async () => {
  const BaseCrudService = await loadServiceCtor()
  const { service, repo } = makeService(BaseCrudService)

  await expectApiError(
    () => service.create({ customerName: '', updatedBy: 'tester' }),
    API_ERROR_CODES.VALIDATION_ERROR,
    422,
  )
  assert.equal(repo.createCalls.length, 0)
})

test('create propagates repository errors', async () => {
  const BaseCrudService = await loadServiceCtor()
  const { service, repo } = makeService(BaseCrudService)
  repo.createError = new Error('create failed')

  await assert.rejects(
    () => service.create({ customerName: 'Alice', updatedBy: 'tester' }),
    /create failed/,
  )
})

test('update rejects blank id with 400 before calling repo', async () => {
  const BaseCrudService = await loadServiceCtor()
  const { service, repo } = makeService(BaseCrudService)

  await expectApiError(
    () => service.update('', { customerName: 'Alice', updatedBy: 'tester' }),
    API_ERROR_CODES.BAD_REQUEST,
    400,
  )
  assert.equal(repo.readCalls.length, 0)
  assert.equal(repo.updateCalls.length, 0)
})

test('update rejects whitespace id with 400 before calling repo', async () => {
  const BaseCrudService = await loadServiceCtor()
  const { service, repo } = makeService(BaseCrudService)

  await expectApiError(
    () => service.update('   ', { customerName: 'Alice', updatedBy: 'tester' }),
    API_ERROR_CODES.BAD_REQUEST,
    400,
  )
  assert.equal(repo.readCalls.length, 0)
  assert.equal(repo.updateCalls.length, 0)
})

test('update validates payload before reading row', async () => {
  const BaseCrudService = await loadServiceCtor()
  const { service, repo } = makeService(BaseCrudService)

  await expectApiError(
    () => service.update('C001', { updatedBy: 'tester' }),
    API_ERROR_CODES.VALIDATION_ERROR,
    422,
  )
  assert.equal(repo.readCalls.length, 0)
  assert.equal(repo.updateCalls.length, 0)
})

test('update rejects field-level invalid payload before existence guard', async () => {
  const BaseCrudService = await loadServiceCtor()
  const { service, repo } = makeService(BaseCrudService)

  await expectApiError(
    () => service.update('C001', { customerName: '', updatedBy: 'tester' }),
    API_ERROR_CODES.VALIDATION_ERROR,
    422,
  )
  assert.equal(repo.readCalls.length, 0)
  assert.equal(repo.updateCalls.length, 0)
})

test('update throws 404 before repo.update when row is missing', async () => {
  const BaseCrudService = await loadServiceCtor()
  const missing = makeService(BaseCrudService)
  missing.repo.nextReadResponse = []

  await expectApiError(
    () => missing.service.update('C404', { customerName: 'Alice', updatedBy: 'tester' }),
    API_ERROR_CODES.NOT_FOUND,
    404,
  )
  assert.equal(missing.repo.updateCalls.length, 0)
})

test('update throws 409 before repo.update when duplicate rows are found', async () => {
  const BaseCrudService = await loadServiceCtor()
  const duplicate = makeService(BaseCrudService)
  duplicate.repo.nextReadResponse = [{ customerId: 'C001' }, { customerId: 'C001' }]

  await expectApiError(
    () => duplicate.service.update('C001', { customerName: 'Alice', updatedBy: 'tester' }),
    API_ERROR_CODES.CONFLICT,
    409,
  )
  assert.equal(duplicate.repo.updateCalls.length, 0)
})

test('update sends semantic id and parsed data, then projects update response', async () => {
  const BaseCrudService = await loadServiceCtor()
  const { service, repo } = makeService(BaseCrudService)
  repo.nextReadResponse = [{ customerId: 'C001' }]
  const rawResponse = {
    customerId: 'C001',
    customerName: 'Alice',
    phone: 99999,
    updatedBy: 'tester',
  }
  repo.nextUpdateResponse = rawResponse

  assert.deepEqual(
    await service.update('C001', {
      phone: null,
      updatedBy: 'tester',
    }),
    {
      customerId: 'C001',
      phone: 99999,
    },
  )
  assert.deepEqual(repo.readCalls, [ReadQueryDTO.fromId('C001')])
  assert.deepEqual(repo.updateCalls, [
    {
      id: 'C001',
      data: {
        phone: null,
        updatedBy: 'tester',
      },
    },
  ])
  assert.deepEqual(rawResponse, {
    customerId: 'C001',
    customerName: 'Alice',
    phone: 99999,
    updatedBy: 'tester',
  })
})

test('update trims id before read and update', async () => {
  const BaseCrudService = await loadServiceCtor()
  const { service, repo } = makeService(BaseCrudService)
  repo.nextReadResponse = [{ customerId: 'C001' }]
  repo.nextUpdateResponse = {
    customerId: 'C001',
    phone: null,
  }

  await service.update('  C001  ', {
    phone: null,
    updatedBy: 'tester',
  })

  assert.deepEqual(repo.readCalls, [ReadQueryDTO.fromId('C001')])
  assert.deepEqual(repo.updateCalls, [
    {
      id: 'C001',
      data: {
        phone: null,
        updatedBy: 'tester',
      },
    },
  ])
})

test('update strips unknown fields before repo.update', async () => {
  const BaseCrudService = await loadServiceCtor()
  const { service, repo } = makeService(BaseCrudService)
  repo.nextReadResponse = [{ customerId: 'C001' }]
  repo.nextUpdateResponse = {
    customerId: 'C001',
    phone: null,
  }

  await service.update('C001', {
    phone: null,
    updatedBy: 'tester',
    hackerField: 'strip-me',
  })

  assert.deepEqual(repo.updateCalls, [
    {
      id: 'C001',
      data: {
        phone: null,
        updatedBy: 'tester',
      },
    },
  ])
})

test('update projection does not mutate repository row objects', async () => {
  const BaseCrudService = await loadServiceCtor()
  const { service, repo } = makeService(BaseCrudService)
  repo.nextReadResponse = [{ customerId: 'C001' }]
  const rawResponse = {
    customerId: 'C001',
    customerName: 'Alice',
    phone: null,
  }
  repo.nextUpdateResponse = rawResponse

  await service.update('C001', {
    phone: null,
    updatedBy: 'tester',
  })

  assert.deepEqual(rawResponse, {
    customerId: 'C001',
    customerName: 'Alice',
    phone: null,
  })
})

test('update propagates repository errors from repo.update', async () => {
  const BaseCrudService = await loadServiceCtor()
  const { service, repo } = makeService(BaseCrudService)
  repo.nextReadResponse = [{ customerId: 'C001' }]
  repo.updateError = new Error('update failed')

  await assert.rejects(
    () => service.update('C001', { phone: null, updatedBy: 'tester' }),
    /update failed/,
  )
})

function makeReadOnlyService(BaseCrudService: BaseCrudServiceCtor, repo = new FakeRepository()) {
  const service = new BaseCrudService({
    repository: repo,
    api: {
      query: { list: listQuerySchema },
      response: {
        list: listResponseSchema,
      },
    },
    searchFields: [],
  })

  return { service, repo }
}

test('read-only service list still works without write slots', async () => {
  const BaseCrudService = await loadServiceCtor()
  const { service, repo } = makeReadOnlyService(BaseCrudService)
  repo.nextReadResponse = [{ customerId: 'C001', customerName: 'Alice' }]

  assert.deepEqual(await service.list({}), {
    items: [{ customerId: 'C001', customerName: 'Alice' }],
    pagination: { page: 1, perPage: 20 },
  })
  assert.equal(repo.readCalls.length, 1)
})

test('read-only service create throws before any repository call', async () => {
  const BaseCrudService = await loadServiceCtor()
  const { service, repo } = makeReadOnlyService(BaseCrudService)

  await assert.rejects(
    () => service.create({ customerName: 'Alice', updatedBy: 'tester' }),
    /create is not supported by this module/,
  )
  assert.equal(repo.createCalls.length, 0)
  assert.equal(repo.readCalls.length, 0)
  assert.equal(repo.updateCalls.length, 0)
})

test('read-only service update throws before any repository call', async () => {
  const BaseCrudService = await loadServiceCtor()
  const { service, repo } = makeReadOnlyService(BaseCrudService)

  await assert.rejects(
    () => service.update('C001', { customerName: 'Alice', updatedBy: 'tester' }),
    /update is not supported by this module/,
  )
  assert.equal(repo.createCalls.length, 0)
  assert.equal(repo.readCalls.length, 0)
  assert.equal(repo.updateCalls.length, 0)
})

test('read-only service getById throws before any repository call', async () => {
  const BaseCrudService = await loadServiceCtor()
  const { service, repo } = makeReadOnlyService(BaseCrudService)

  await assert.rejects(
    () => service.getById('C001'),
    /getById is not supported by this module/,
  )
  assert.equal(repo.createCalls.length, 0)
  assert.equal(repo.readCalls.length, 0)
  assert.equal(repo.updateCalls.length, 0)
})

async function main(): Promise<void> {
  for (const item of tests) {
    await item.run()
  }
  console.log(`${tests.length} BaseCrudService dry tests passed`)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
