import assert from 'node:assert/strict'
import { generateKeyPairSync } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import type { ApiHandlerRequest } from '../../../../../server/shared/http/api-handler.js'

process.env.ORDERS_SPREADSHEET_ID = 'laundry-photos-test-spreadsheet'
const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
process.env.GOOGLE_SERVICE_ACCOUNT_KEY = Buffer.from(JSON.stringify({
  client_email: 'laundry-photos@example.test',
  private_key: String(privateKey.export({ format: 'pem', type: 'pkcs8' })),
})).toString('base64')

const { createLaundryPhotoRepository, laundryPhotoRoutes } = await import('../../../../../server/modules/laundry-photos/laundry-photo.module.js')
const moduleSource = readFileSync(
  fileURLToPath(new URL('../../../../../server/modules/laundry-photos/laundry-photo.module.ts', import.meta.url)),
  'utf8',
)
assert.doesNotMatch(moduleSource, /formatBangkokTimestamp/)

const headers = [
  'id', 'order_id', 'orderitem_id', 'item_id', 'image_path', 'image_url', 'notes', 'timestamp',
  'created_by', 'updated_by', 'updated_at', 'checked', 'is_active', 'file_id', 'deleted_at', 'deleted_by',
]
const rows: unknown[][] = []

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } })
}

function request(method: string, body: unknown, params: Record<string, string> = {}): ApiHandlerRequest {
  return { method, query: {}, body, headers: {}, params }
}

const originalFetch = globalThis.fetch
globalThis.fetch = (async (input: URL | string, init?: RequestInit) => {
  const url = String(input)
  if (url === 'https://oauth2.googleapis.com/token') {
    return jsonResponse({ access_token: 'token', expires_in: 3600 })
  }

  const path = decodeURIComponent(new URL(url).pathname)
  if (init?.method === 'GET' && path.endsWith('/values/LaundryPhotos!1:1')) {
    return jsonResponse({ values: [headers] })
  }
  if (init?.method === 'POST' && path.endsWith('/values/LaundryPhotos!A:A:append')) {
    const body = JSON.parse(String(init.body)) as { values: unknown[][] }
    assert.ok(body.values.length > 0)
    for (const row of body.values) {
      assert.equal(row.length, 16)
      rows.push(row)
    }
    return jsonResponse({
      updates: {
        updatedRows: body.values.length,
        updatedRange: `LaundryPhotos!A${rows.length - body.values.length + 2}:P${rows.length + 1}`,
        updatedData: { values: body.values },
      },
    })
  }
  throw new Error(`Unexpected request: ${init?.method} ${path}`)
}) as typeof fetch

try {
  for (const invalid of [
    { imageUrl: 'https://example.test/photo.jpg', createdBy: 'staff-1' },
    { orderId: '', imageUrl: 'https://example.test/photo.jpg', createdBy: 'staff-1' },
    { orderId: 'order-1', imageUrl: '', createdBy: 'staff-1' },
    { orderId: 'order-1', imageUrl: 'https://example.test/photo.jpg', createdBy: '' },
  ]) {
    const result = await laundryPhotoRoutes.collection.handleRequest(request('POST', invalid))
    assert.equal(result.status, 422)
  }
  assert.equal(rows.length, 0, 'invalid creates must not append')

  for (const forbiddenKey of [
    'id', 'laundryPhotoId', 'createdAt', 'updatedAt', 'updatedBy', 'imagePath', 'notes',
    'checked', 'isActive', 'fileId', 'deletedAt', 'deletedBy',
  ] as const) {
    const result = await laundryPhotoRoutes.collection.handleRequest(request('POST', {
      orderId: 'order-1', imageUrl: 'https://example.test/photo.jpg', createdBy: 'staff-1',
      [forbiddenKey]: forbiddenKey === 'isActive' ? true : 'client-value',
    }))
    assert.equal(result.status, 422)
  }
  assert.equal(rows.length, 0, 'forbidden create fields must not append')

  const created = await laundryPhotoRoutes.collection.handleRequest(request('POST', {
    orderId: ' order-1 ',
    orderItemId: ' order-item-1 ',
    itemId: ' item-1 ',
    imageUrl: ' https://example.test/photo.jpg ',
    createdBy: ' staff-1 ',
  }))
  assert.equal(created.status, 201)
  assert.equal(rows.length, 1)
  const firstRow = rows[0]!
  assert.equal(firstRow.length, 16)
  assert.match(String(firstRow[0]), /^[0-9a-f]{8}$/)
  assert.deepEqual(firstRow.slice(1, 4), ['order-1', 'order-item-1', 'item-1'])
  assert.equal(firstRow[4], '')
  assert.equal(firstRow[5], 'https://example.test/photo.jpg')
  assert.equal(firstRow[6], '')
  assert.match(String(firstRow[7]), /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)
  assert.equal(firstRow[8], 'staff-1')
  assert.equal(firstRow[9], '')
  assert.equal(firstRow[10], '')
  assert.deepEqual(firstRow.slice(11), ['', '', '', '', ''])

  const createdWithoutItems = await laundryPhotoRoutes.collection.handleRequest(request('POST', {
    orderId: 'order-2', imageUrl: 'https://example.test/photo-2.jpg', createdBy: 'staff-2',
  }))
  assert.equal(createdWithoutItems.status, 201)
  assert.equal(rows.length, 2)
  assert.deepEqual(rows[1]!.slice(1, 4), ['order-2', '', ''])

  const repository = createLaundryPhotoRepository()
  await repository.append({ id: 'server-provided-id' })
  assert.equal(rows[2]![0], 'server-provided-id')

  await repository.batchAppend([{ id: 'batch-provided-id' }, {}])
  assert.equal(rows[3]![0], 'batch-provided-id')
  assert.match(String(rows[4]![0]), /^[0-9a-f]{8}$/)

} finally {
  globalThis.fetch = originalFetch
}

console.log('laundry-photo writes dry test passed')
