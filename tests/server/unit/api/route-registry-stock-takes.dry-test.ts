import assert from 'node:assert/strict'
import { test } from 'node:test'
import { resolveRoute } from '../../../../server/api/route-registry.js'
import type { ApiHandlerRequest } from '../../../../server/shared/http/api-handler.js'
import { getStockTakesRepository } from '../../../../server/sheets/StockTakes/StockTakes.repository.js'

const staff = { staffId: 'staff', role: 'staff', email: 'staff@example.test', name: 'Staff' } as const
const admin = { ...staff, role: 'admin' } as const

function request(method: string, action?: string, actor: ApiHandlerRequest['staff'] = staff, body: unknown = { sessionId: 'ST-1' }): ApiHandlerRequest {
  return { method, query: {}, body, headers: {}, params: action ? { id: action } : {}, staff: actor }
}

test('registered stock-take routes validate role, payload, and action', async () => {
  const { collection, item } = await resolveRoute('stock-takes')
  assert.ok(item)
  assert.equal((await collection.handleRequest({ ...request('GET'), staff: undefined })).status, 401)
  assert.equal((await collection.handleRequest(request('GET', undefined, { ...staff, role: 'device' }))).status, 403)
  assert.equal((await collection.handleRequest(request('POST'))).status, 403)
  assert.equal((await collection.handleRequest(request('POST', undefined, admin, { openedBy: 'forged' }))).status, 422)
  assert.equal((await item.handleRequest(request('GET', 'report'))).status, 403)
  for (const action of ['close', 'cancel', 'resolutions', 'preview', 'apply', 'finish']) {
    assert.equal((await item.handleRequest(request('POST', action))).status, 403, action)
  }
  assert.equal((await item.handleRequest(request('GET', 'unknown', admin))).status, 404)
  assert.equal((await item.handleRequest(request('POST', 'scans'))).status, 422)
  assert.equal((await item.handleRequest(request('POST', 'finish', admin, {}))).status, 422)
})

test('all ticket, bag, membership, intake, and work-order writers are frozen in OPEN and CLOSED', async () => {
  process.env.JOB_TICKETS_SPREADSHEET_ID = 'dry-job-tickets'
  const repository = getStockTakesRepository()
  const readFresh = repository.readFresh
  let reads = 0
  const routes = [
    ['job-tickets', 'PATCH', 'ticket'],
    ...['advance', 'start-order', 'complete-order', 'reopen'].map(action => ['job-tickets', 'POST', action]),
    ['packaging-bags', 'POST', 'confirm'],
    ['bag-items', 'POST'],
    ['order-images', 'POST'],
    ['laundry-photos', 'POST'],
    ['laundry-photos', 'PATCH', 'photo'],
    ['laundry-photos', 'POST', 'reassign'],
    ['work-orders', 'POST'],
    ['work-orders', 'PATCH', 'order'],
    ['order-intakes', 'POST'],
    ['order-garments', 'POST'],
    ['order-garments', 'PATCH', 'garment'],
  ] as Array<[string, string, string?]>
  try {
    for (const status of ['OPEN', 'CLOSED'] as const) {
      repository.readFresh = async () => {
        reads++
        return [{ id: 'ST-1', status }]
      }
      for (const [module, method, action] of routes) {
        const route = await resolveRoute(module)
        const handler = action ? route.item! : route.collection
        const response = await handler.handleRequest(request(method, action, admin, { imageType: 'WEIGHT' }))
        assert.equal(response.status, 409, [module, method, action].join(' '))
        assert.equal((response.body as { error: { code: string } }).error.code, 'STOCK_TAKE_ACTIVE')
      }
    }
    const images = await resolveRoute('order-images')
    assert.equal((await images.collection.handleRequest(request('POST', undefined, admin, { imageType: 'DOCUMENT' }))).status, 422)
    assert.equal(reads, 2 * routes.length)
    repository.readFresh = async () => [{ id: 'ST-1', status: 'APPLIED' }]
    const bagItems = await resolveRoute('bag-items')
    assert.equal((await bagItems.collection.handleRequest(request('POST', undefined, admin, {}))).status, 422)
  } finally {
    repository.readFresh = readFresh
  }
})
