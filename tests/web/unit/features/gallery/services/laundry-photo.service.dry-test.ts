import assert from 'node:assert/strict'

import { reassignPhoto } from '@/features/gallery/services/laundry-photo.service'

interface Call {
  body: string
  method: string
  url: URL
}

async function withMockFetch(run: (calls: Call[]) => Promise<void>): Promise<void> {
  const originalFetch = globalThis.fetch
  const calls: Call[] = []
  globalThis.fetch = (async (input: URL | string, init?: RequestInit) => {
    calls.push({
      url: new URL(String(input), 'http://localhost'),
      method: init?.method ?? 'GET',
      body: String(init?.body ?? ''),
    })
    return new Response(JSON.stringify({ data: { reassigned: true } }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }) as typeof fetch

  try {
    await run(calls)
  } finally {
    globalThis.fetch = originalFetch
  }
}

await withMockFetch(async (calls) => {
  const payload = { orderItemId: 'item-2', updatedBy: 'staff-1' }

  await reassignPhoto('BEF', 'photo/before-1', payload)
  await reassignPhoto('AFT', 'photo-after-1', payload)

  assert.equal(calls.length, 2)
  assert.equal(calls[0]!.url.pathname, '/api/laundry-photos/photo%2Fbefore-1')
  assert.equal(calls[0]!.method, 'PATCH')
  assert.deepEqual(JSON.parse(calls[0]!.body), payload)
  assert.equal(calls[1]!.url.pathname, '/api/after-photos/photo-after-1')
  assert.equal(calls[1]!.method, 'PATCH')
  assert.deepEqual(JSON.parse(calls[1]!.body), payload)

  await assert.rejects(
    () => reassignPhoto('UNKNOWN' as never, 'photo-unknown', payload),
    /Unsupported gallery photo type/,
  )
  assert.equal(calls.length, 2, 'an unknown type must not make a request')

  await assert.rejects(
    () => reassignPhoto('BEF', 'photo-missing-item', { updatedBy: 'staff-1' } as never),
  )
  await assert.rejects(
    () => reassignPhoto('AFT', 'photo-missing-actor', { orderItemId: 'item-2' } as never),
  )
  assert.equal(calls.length, 2, 'invalid payloads must be rejected before a request')
})

console.log('laundry-photo.service.dry-test: OK')
