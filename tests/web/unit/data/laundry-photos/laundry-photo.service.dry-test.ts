import assert from 'node:assert/strict'

import {
  createPhoto,
  listGalleryPhotos,
  reassignPhoto,
} from '@/features/gallery/services/laundry-photo.service'
import { invalidate, readCache, writeCache } from '@/shared/api/response-cache'

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
  invalidate()
  const createPayload = {
    orderId: 'order-1',
    imageUrl: 'https://example.com/photo.jpg',
    createdBy: 'staff-1',
    orderItemId: 'order-item-1',
    itemId: 'item-1',
  }
  const payload = { orderItemId: 'item-2', updatedBy: 'staff-1' }

  writeCache('/api/laundry-photos?orderId=order-1', ['stale'])
  await createPhoto('BEF', createPayload)
  assert.equal(readCache('/api/laundry-photos?orderId=order-1'), null)

  writeCache('/api/after-photos?orderId=order-1', ['stale'])
  await createPhoto('AFT', createPayload)
  assert.equal(readCache('/api/after-photos?orderId=order-1'), null)

  writeCache('/api/laundry-photos?orderId=order-1', ['stale'])
  await reassignPhoto('BEF', 'photo/before-1', payload)
  assert.equal(readCache('/api/laundry-photos?orderId=order-1'), null)

  writeCache('/api/after-photos?orderId=order-1', ['stale'])
  await reassignPhoto('AFT', 'photo-after-1', payload)
  assert.equal(readCache('/api/after-photos?orderId=order-1'), null)

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
  invalidate()
})

const originalFetch = globalThis.fetch
const originalNow = Date.now
const listCalls: URL[] = []
let now = Date.now()
let afterVersion = 1
Date.now = () => now
globalThis.fetch = (async (input: URL | string) => {
  const url = new URL(String(input), 'http://localhost')
  listCalls.push(url)
  const data = url.pathname === '/api/laundry-photos'
    ? [
        { laundryPhotoId: 'before-1', orderItemId: 'item-before', imageUrl: 'https://example.com/before.jpg', notes: 'before' },
        { laundryPhotoId: 'before-missing', orderItemId: null, imageUrl: null, notes: null },
      ]
    : [
        { afterPhotoId: 'after-1', orderItemId: 'item-after', imageUrl: `https://example.com/after-${afterVersion}.jpg`, notes: null },
        { afterPhotoId: 'after-2', orderItemId: 'item-other', imageUrl: 'https://example.com/other.jpg', notes: 'other' },
      ]
  return new Response(JSON.stringify({
    success: true,
    data,
    meta: { pagination: { page: 1, perPage: 500 } },
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}) as typeof fetch

try {
  invalidate()
  const beforePhotos = await listGalleryPhotos('BEF', 'order-before')
  const afterPhotos = await listGalleryPhotos('AFT', 'order-after')

  assert.equal(listCalls.length, 2)
  assert.equal(listCalls[0]!.pathname, '/api/laundry-photos')
  assert.equal(listCalls[0]!.searchParams.get('orderId'), 'order-before')
  assert.equal(listCalls[0]!.searchParams.has('orderItemId'), false)
  assert.equal(listCalls[0]!.searchParams.get('page'), '1')
  assert.equal(listCalls[0]!.searchParams.get('perPage'), '500')
  assert.equal(listCalls[0]!.searchParams.get('sortBy'), 'createdAt')
  assert.equal(listCalls[0]!.searchParams.get('sortOrder'), 'asc')
  assert.equal(listCalls[1]!.pathname, '/api/after-photos')
  assert.equal(listCalls[1]!.searchParams.get('orderId'), 'order-after')
  assert.equal(listCalls[1]!.searchParams.has('orderItemId'), false)
  assert.equal(listCalls[1]!.searchParams.get('page'), '1')
  assert.equal(listCalls[1]!.searchParams.get('perPage'), '500')
  assert.equal(listCalls[1]!.searchParams.get('sortBy'), 'createdAt')
  assert.equal(listCalls[1]!.searchParams.get('sortOrder'), 'asc')
  assert.deepEqual(beforePhotos, [
    { id: 'before-1', orderItemId: 'item-before', imageUrl: 'https://example.com/before.jpg', notes: 'before' },
  ])
  assert.deepEqual(afterPhotos, [
    { id: 'after-1', orderItemId: 'item-after', imageUrl: 'https://example.com/after-1.jpg', notes: null },
    { id: 'after-2', orderItemId: 'item-other', imageUrl: 'https://example.com/other.jpg', notes: 'other' },
  ])

  const beforeItemPhotos = await listGalleryPhotos('BEF', 'order-before', 'item-before')
  assert.deepEqual(beforeItemPhotos, beforePhotos)

  const itemPhotos = await listGalleryPhotos('AFT', 'order-after', 'item-after')
  assert.deepEqual(itemPhotos, [
    { id: 'after-1', orderItemId: 'item-after', imageUrl: 'https://example.com/after-1.jpg', notes: null },
  ])
  assert.equal(listCalls.length, 2, 'item views reuse both fresh full-album responses')

  now += 60 * 60 * 1000 + 1
  afterVersion = 2
  let freshItemPhotos: Awaited<ReturnType<typeof listGalleryPhotos>> | null = null
  const staleItemPhotos = await listGalleryPhotos('AFT', 'order-after', 'item-after', (photos) => {
    freshItemPhotos = photos
  })
  assert.deepEqual(staleItemPhotos, itemPhotos, 'a stale item view returns cached photos immediately')
  await new Promise(resolve => setTimeout(resolve, 0))
  assert.deepEqual(freshItemPhotos, [
    { id: 'after-1', orderItemId: 'item-after', imageUrl: 'https://example.com/after-2.jpg', notes: null },
  ])
  assert.equal(listCalls.length, 3)
} finally {
  invalidate()
  Date.now = originalNow
  globalThis.fetch = originalFetch
}

console.log('laundry-photo.service.dry-test: OK')
