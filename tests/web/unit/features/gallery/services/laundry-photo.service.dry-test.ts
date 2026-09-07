import assert from 'node:assert/strict'

import { createPhoto, reassignPhoto } from '@/features/gallery/services/laundry-photo.service'

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
  const createPayload = {
    orderId: 'order-1',
    imageUrl: 'https://example.com/photo.jpg',
    createdBy: 'staff-1',
    orderItemId: 'order-item-1',
    itemId: 'item-1',
  }
  const payload = { orderItemId: 'item-2', updatedBy: 'staff-1' }

  await createPhoto('BEF', createPayload)
  await createPhoto('AFT', createPayload)
  await reassignPhoto('BEF', 'photo/before-1', payload)
  await reassignPhoto('AFT', 'photo-after-1', payload)

  assert.equal(calls.length, 4)
  assert.equal(calls[0]!.url.pathname, '/api/laundry-photos')
  assert.equal(calls[0]!.method, 'POST')
  assert.deepEqual(JSON.parse(calls[0]!.body), createPayload)
  assert.equal(calls[1]!.url.pathname, '/api/after-photos')
  assert.equal(calls[1]!.method, 'POST')
  assert.deepEqual(JSON.parse(calls[1]!.body), createPayload)
  assert.equal(calls[2]!.url.pathname, '/api/laundry-photos/photo%2Fbefore-1')
  assert.equal(calls[2]!.method, 'PATCH')
  assert.deepEqual(JSON.parse(calls[2]!.body), payload)
  assert.equal(calls[3]!.url.pathname, '/api/after-photos/photo-after-1')
  assert.equal(calls[3]!.method, 'PATCH')
  assert.deepEqual(JSON.parse(calls[3]!.body), payload)

  await assert.rejects(
    () => createPhoto('UNKNOWN' as never, createPayload),
    /Unsupported gallery photo type/,
  )
  assert.equal(calls.length, 4, 'an unknown type must not make a request')

  await assert.rejects(
    () => createPhoto('BEF', { ...createPayload, id: 'client-id' } as never),
  )
  await assert.rejects(
    () => createPhoto('AFT', { orderId: 'order-1', createdBy: 'staff-1' } as never),
  )
  assert.equal(calls.length, 4, 'invalid create payloads must be rejected before a request')

  await assert.rejects(
    () => reassignPhoto('UNKNOWN' as never, 'photo-unknown', payload),
    /Unsupported gallery photo type/,
  )
  assert.equal(calls.length, 4, 'an unknown type must not make a request')

  await assert.rejects(
    () => reassignPhoto('BEF', 'photo-missing-item', { updatedBy: 'staff-1' } as never),
  )
  await assert.rejects(
    () => reassignPhoto('AFT', 'photo-missing-actor', { orderItemId: 'item-2' } as never),
  )
  assert.equal(calls.length, 4, 'invalid payloads must be rejected before a request')
})

console.log('laundry-photo.service.dry-test: OK')
