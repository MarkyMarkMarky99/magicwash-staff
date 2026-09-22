import assert from 'node:assert/strict'
import { generateKeyPairSync } from 'node:crypto'
import { itemsRoutes } from '../../../../../server/modules/items/items.module.js'

process.env.PRICE_LIST_SPREADSHEET_ID = 'items-write-test'
const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
process.env.GOOGLE_SERVICE_ACCOUNT_KEY = Buffer.from(JSON.stringify({
  client_email: 'items-test@example.test',
  private_key: String(privateKey.export({ format: 'pem', type: 'pkcs8' })),
})).toString('base64')

const headers = ['id', 'item_code', 'category', 'subcategory', 'itemtype', 'variant',
  'display_name_th', 'display_name_en', 'active', 'image_url']
const row: unknown[] = ['a1b2c3d4', 'ITM-0098', 'Clothing', 'Tops', 'Shirt', 'Cotton',
  'เสื้อ', 'Shirt', false, 'https://example.test/shirt.jpg']
let writeCount = 0
const originalFetch = globalThis.fetch
function json(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200 })
}
globalThis.fetch = (async (input: string | URL, init?: RequestInit) => {
  const url = String(input)
  if (url === 'https://oauth2.googleapis.com/token') {
    return json({ access_token: 'test-token', expires_in: 3600 })
  }
  if (url.includes('/gviz/tq')) {
    return new Response(`google.visualization.Query.setResponse(${JSON.stringify({
      status: 'ok', table: {
        cols: headers.map((_, index) => ({ id: String.fromCharCode(65 + index) })),
        rows: [{ c: row.map((value) => ({ v: value === '' ? null : value })) }],
      },
    })});`)
  }
  const path = decodeURIComponent(new URL(url).pathname)
  if (init?.method === 'GET' && path.endsWith('/values/Items!1:1')) return json({ values: [headers] })
  if (init?.method === 'GET' && path.endsWith('/values/Items!A:A')) return json({ values: [['id'], [row[0]]] })
  if (init?.method === 'GET' && path.endsWith('/values/Items!A2:J2')) return json({ values: [row] })
  if (init?.method === 'POST' && path.endsWith('/values:batchUpdate')) {
    const body = JSON.parse(String(init.body)) as { data: { range: string; values: unknown[][] }[] }
    assert.deepEqual(body.data.map((entry) => entry.range), ['Items!F2:F2', 'Items!H2:H2', 'Items!J2:J2'])
    for (const entry of body.data) {
      // Sheets skips JSON null; an empty string is required to clear a cell.
      assert.deepEqual(entry.values, [['']])
      const column = /Items!([A-Z])2/.exec(entry.range)![1]!.charCodeAt(0) - 65
      row[column] = entry.values[0]![0]
    }
    writeCount += 1
    return json({ responses: body.data.map(() => ({})) })
  }
  throw new Error(`Unexpected test request: ${init?.method} ${path}`)
}) as typeof fetch

try {
  const result = await itemsRoutes.item!.handleRequest({
    method: 'PATCH', query: {}, params: { id: 'a1b2c3d4' }, headers: {},
    body: { variant: null, displayNameEn: null, imageUrl: null },
  })
  assert.equal(result.status, 200)
  assert.equal(writeCount, 1)
  const data = (result.body as { data: Record<string, unknown> }).data
  assert.equal(data.variant, null)
  assert.equal(data.displayNameEn, null)
  assert.equal(data.imageUrl, null)
  assert.equal(data.active, false)
  assert.equal(data.itemCode, 'ITM-0098')
} finally {
  globalThis.fetch = originalFetch
}
console.log('items nullable write transport dry test passed')
