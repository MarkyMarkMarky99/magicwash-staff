import assert from 'node:assert/strict'
import test from 'node:test'
import { listLaundryPhotos, listLaundryPhotoTagIds } from '@/data/laundry-photos/laundry-photo.service'
import { invalidate, readCache, writeCache } from '@/shared/api/response-cache'

test('duplicate lookup includes every order page and rows without an image URL', async () => {
  const originalFetch = globalThis.fetch
  const pages: number[] = []
  const otherOrderUrl = '/api/laundry-photos?orderId=other-order'
  writeCache(otherOrderUrl, ['preserved'])
  globalThis.fetch = (async input => {
    const url = new URL(String(input), 'http://localhost')
    assert.equal(url.pathname, '/api/laundry-photos')
    assert.equal(url.searchParams.get('orderId'), 'order-1')
    const page = Number(url.searchParams.get('page'))
    pages.push(page)
    const data = page === 1
      ? Array.from({ length: 500 }, (_, index) => ({ itemId: index === 0 ? 18806075 : index === 1 ? 9305753 : null, imageUrl: null }))
      : [{ itemId: '87654321', imageUrl: 'https://example.com/photo.jpg' }]
    return new Response(JSON.stringify({
      success: true,
      data,
      meta: { pagination: { page, perPage: 500, total: 501, totalPages: 2 } },
    }), { status: 200, headers: { 'Content-Type': 'application/json' } })
  }) as typeof fetch

  try {
    const [galleryPhotos, tags] = await Promise.all([
      listLaundryPhotos('order-1'),
      listLaundryPhotoTagIds('order-1'),
    ])
    assert.deepEqual(galleryPhotos, [])
    assert.deepEqual(pages, [1, 2])
    assert.deepEqual(tags, new Set(['18806075', '09305753', '87654321']))
    assert.deepEqual(readCache<string[]>(otherOrderUrl)?.value, ['preserved'])
  } finally {
    invalidate()
    globalThis.fetch = originalFetch
  }
})

test('stale first-page tags deliver fresh IDs without invalidating the cache', async () => {
  const originalFetch = globalThis.fetch
  const originalNow = Date.now
  let now = originalNow()
  let tagId = 'Ab12Cd34'
  Date.now = () => now
  globalThis.fetch = (async () => new Response(JSON.stringify({
    success: true,
    data: [{ itemId: tagId, imageUrl: null }],
    meta: { pagination: { page: 1, perPage: 500, total: 1, totalPages: 1 } },
  }), { status: 200, headers: { 'Content-Type': 'application/json' } })) as typeof fetch

  try {
    invalidate()
    assert.deepEqual(await listLaundryPhotoTagIds('fresh-order'), new Set(['Ab12Cd34']))
    now += 60 * 60 * 1000 + 1
    tagId = 'Zz90Yy12'
    let freshTags: Set<string> | null = null
    assert.deepEqual(await listLaundryPhotoTagIds('fresh-order', tags => { freshTags = tags }), new Set(['Ab12Cd34']))
    await new Promise(resolve => setTimeout(resolve, 0))
    assert.deepEqual(freshTags, new Set(['Zz90Yy12']))
  } finally {
    invalidate()
    Date.now = originalNow
    globalThis.fetch = originalFetch
  }
})
