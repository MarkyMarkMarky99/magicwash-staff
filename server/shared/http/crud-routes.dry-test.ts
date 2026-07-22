import assert from 'node:assert/strict'
import { z } from 'zod'
import type { ModuleApiContract } from '../../../contracts/shared/module-api-contract.js'
import type { ApiHandlerRequest } from './api-handler.js'
import { createCrudRoutes } from './crud-routes.js'

type FakeService = Parameters<typeof createCrudRoutes>[0]

class RecordingService {
  calls: Array<{ method: string; args: unknown[] }> = []

  async list(query: unknown) {
    this.calls.push({ method: 'list', args: [query] })
    return { items: [{ id: 'row-1' }], pagination: { page: 1, perPage: 20 } }
  }

  async getById(id: unknown) {
    this.calls.push({ method: 'getById', args: [id] })
    return { id }
  }

  async create(payload: unknown) {
    this.calls.push({ method: 'create', args: [payload] })
    return { id: 'created', ...(payload as object) }
  }

  async update(id: unknown, payload: unknown) {
    this.calls.push({ method: 'update', args: [id, payload] })
    return { id, ...(payload as object) }
  }
}

function asService(service: RecordingService): FakeService {
  return service as unknown as FakeService
}

function req(overrides: Partial<ApiHandlerRequest> = {}): ApiHandlerRequest {
  return { method: 'GET', query: {}, body: undefined, headers: {}, params: {}, ...overrides }
}

const responseShape = z.object({ id: z.string() })
const anySchema = z.any()

// Minimal contract fixtures — the factory only checks slot presence/absence, never
// parses these schemas, so their content is irrelevant beyond satisfying the type.
const fullCrudApi: ModuleApiContract = {
  query: { list: anySchema },
  request: { create: anySchema, update: anySchema },
  response: { list: responseShape, detail: responseShape, create: responseShape, update: responseShape },
}

const listOnlyApi: ModuleApiContract = {
  query: { list: anySchema },
  response: { list: responseShape },
}

const updateWithoutDetailApi: ModuleApiContract = {
  query: { list: anySchema },
  request: { create: anySchema, update: anySchema },
  response: { list: responseShape, update: responseShape },
}

const createRequestWithoutResponseApi: ModuleApiContract = {
  query: { list: anySchema },
  request: { create: anySchema, update: anySchema },
  response: { list: responseShape },
}

const detailOnlyApi: ModuleApiContract = {
  query: { list: anySchema },
  response: { list: responseShape, detail: responseShape },
}

// `request` is declared as one all-or-nothing pair on ModuleApiContract (create+update
// together), so "response.create without request.create" can only be expressed with
// `request` entirely absent — this also exercises "response.update without request.update"
// in the same fixture, since both request slots are absent together.
const responseWriteSlotsWithoutRequestApi: ModuleApiContract = {
  query: { list: anySchema },
  response: { list: responseShape, create: responseShape, update: responseShape },
}

const tests: Array<{ name: string; run: () => Promise<void> | void }> = []
function test(name: string, run: () => Promise<void> | void): void {
  tests.push({ name, run })
}

test('full CRUD contract wires GET+POST collection and GET+PATCH item', async () => {
  const service = new RecordingService()
  const { collection, item } = createCrudRoutes(asService(service), fullCrudApi)
  assert.ok(item)

  const listResult = await collection.handleRequest(req({ method: 'GET' }))
  assert.equal(listResult.status, 200)

  const createResult = await collection.handleRequest(
    req({ method: 'POST', body: { name: 'x' } }),
  )
  assert.equal(createResult.status, 201)

  const getResult = await item.handleRequest(req({ method: 'GET', params: { id: 'a1' } }))
  assert.equal(getResult.status, 200)

  const updateResult = await item.handleRequest(
    req({ method: 'PATCH', params: { id: 'a1' }, body: { name: 'y' } }),
  )
  assert.equal(updateResult.status, 200)

  assert.deepEqual(
    service.calls.map((c) => c.method),
    ['list', 'create', 'getById', 'update'],
  )
})

test('full CRUD contract rejects unsupported methods with the exact Allow header', async () => {
  const service = new RecordingService()
  const { collection, item } = createCrudRoutes(asService(service), fullCrudApi)
  assert.ok(item)

  const collectionResult = await collection.handleRequest(req({ method: 'DELETE' }))
  assert.equal(collectionResult.status, 405)
  assert.equal(collectionResult.headers?.Allow, 'GET, POST')

  const itemResult = await item.handleRequest(req({ method: 'POST', params: { id: 'a1' } }))
  assert.equal(itemResult.status, 405)
  assert.equal(itemResult.headers?.Allow, 'GET, PATCH')
})

test('list-only contract (orders shape) has no item handler and no collection POST', async () => {
  const service = new RecordingService()
  const { collection, item } = createCrudRoutes(asService(service), listOnlyApi)

  assert.equal(item, undefined)

  const postResult = await collection.handleRequest(req({ method: 'POST' }))
  assert.equal(postResult.status, 405)
  assert.equal(postResult.headers?.Allow, 'GET')
  assert.equal(service.calls.length, 0)
})

test('update present without response.detail still builds item with PATCH only, no GET', async () => {
  const service = new RecordingService()
  const { item } = createCrudRoutes(asService(service), updateWithoutDetailApi)
  assert.ok(item)

  const getResult = await item.handleRequest(req({ method: 'GET', params: { id: 'a1' } }))
  assert.equal(getResult.status, 405)
  assert.equal(getResult.headers?.Allow, 'PATCH')

  const patchResult = await item.handleRequest(
    req({ method: 'PATCH', params: { id: 'a1' }, body: { name: 'y' } }),
  )
  assert.equal(patchResult.status, 200)
  assert.deepEqual(
    service.calls.map((c) => c.method),
    ['update'],
  )
})

test('request.create without response.create does not wire POST', async () => {
  const service = new RecordingService()
  const { collection } = createCrudRoutes(asService(service), createRequestWithoutResponseApi)

  const postResult = await collection.handleRequest(req({ method: 'POST' }))
  assert.equal(postResult.status, 405)
  assert.equal(postResult.headers?.Allow, 'GET')
  assert.equal(service.calls.length, 0)
})

test('response.detail without update capability builds item with GET only, no PATCH', async () => {
  const service = new RecordingService()
  const { item } = createCrudRoutes(asService(service), detailOnlyApi)
  assert.ok(item)

  const getResult = await item.handleRequest(req({ method: 'GET', params: { id: 'a1' } }))
  assert.equal(getResult.status, 200)

  const patchResult = await item.handleRequest(req({ method: 'PATCH', params: { id: 'a1' } }))
  assert.equal(patchResult.status, 405)
  assert.equal(patchResult.headers?.Allow, 'GET')
})

test('response.create/response.update present without request slots wires neither POST nor PATCH', async () => {
  const service = new RecordingService()
  const { collection, item } = createCrudRoutes(asService(service), responseWriteSlotsWithoutRequestApi)

  assert.equal(item, undefined)

  const postResult = await collection.handleRequest(req({ method: 'POST' }))
  assert.equal(postResult.status, 405)
  assert.equal(postResult.headers?.Allow, 'GET')
  assert.equal(service.calls.length, 0)
})

async function main(): Promise<void> {
  for (const item of tests) {
    await item.run()
  }
  console.log(`${tests.length} createCrudRoutes dry tests passed`)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
