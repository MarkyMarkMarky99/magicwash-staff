import assert from 'node:assert/strict'

interface CapturedResponse {
  statusCode: number
  headers: Record<string, string>
  body: unknown
  status(code: number): CapturedResponse
  setHeader(name: string, value: string): CapturedResponse
  json(body: unknown): CapturedResponse
  end(body?: unknown): CapturedResponse
  send(body: unknown): CapturedResponse
}

function response(): CapturedResponse {
  const captured: CapturedResponse = {
    statusCode: 200, headers: {}, body: undefined,
    status(code) { captured.statusCode = code; return captured },
    setHeader(name, value) { captured.headers[name] = value; return captured },
    json(body) { captured.body = body; return captured },
    end(body) { captured.body = body; return captured },
    send(body) { captured.body = body; return captured },
  }
  return captured
}

async function invoke(method: string, path: string): Promise<CapturedResponse> {
  const handler = (await import('../../../../api/[...path].js')).default as unknown as (req: unknown, res: unknown) => Promise<void>
  const captured = response()
  const segments = path.replace(/^\/api\/?/, '').split('/').filter(Boolean)
  await handler({ method, url: path, originalUrl: path, query: { path: segments }, body: undefined, headers: {} }, captured)
  return captured
}

const oldPortalId = process.env.PORTAL_SPREADSHEET_ID
process.env.PORTAL_SPREADSHEET_ID = 'customer-package-gateway-test'
let fetchCalls = 0
const originalFetch = globalThis.fetch
globalThis.fetch = (async () => { fetchCalls += 1; throw new Error('PATCH must not read the view') }) as typeof fetch

try {
  const patch = await invoke('PATCH', '/api/customer-packages/package-1')
  assert.equal(patch.statusCode, 404)
  assert.equal(patch.headers.Allow, undefined)
  assert.equal(fetchCalls, 0)
} finally {
  globalThis.fetch = originalFetch
  if (oldPortalId === undefined) delete process.env.PORTAL_SPREADSHEET_ID
  else process.env.PORTAL_SPREADSHEET_ID = oldPortalId
}

console.log('customer package gateway dry test passed')
