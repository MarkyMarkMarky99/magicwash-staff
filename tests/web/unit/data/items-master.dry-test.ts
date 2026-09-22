import assert from 'node:assert/strict'
import { createPinia, setActivePinia } from 'pinia'
import { useItemsStore } from '@/data/items/items.store'
import { invalidate } from '@/shared/api/response-cache'

const oldItem = { id: 'abcd1234', itemCode: 'ITM-0001', category: 'Clothing', subcategory: 'Tops',
  itemType: 'Shirt', variant: null, displayNameTh: 'เสื้อ', displayNameEn: null, active: false, imageUrl: null }
const newItem = { ...oldItem, id: 'abcd5678', itemCode: 'ITM-0002', active: true }
const originalFetch = globalThis.fetch
let posts = 0
let failPost = false
let reads = [oldItem]
globalThis.fetch = (async (input: string | URL, init?: RequestInit) => {
  const url = new URL(String(input), 'http://localhost')
  assert.equal(url.pathname, '/api/items', 'item creation must never write PriceList')
  if (init?.method === 'POST') {
    posts += 1
    const payload = JSON.parse(String(init.body))
    assert.equal(payload.itemType, 'Shirt')
    assert.equal(payload.active, true)
    assert.equal('price' in payload, false)
    assert.equal('serviceType' in payload, false)
    assert.equal('itemCode' in payload, false)
    if (failPost) throw new TypeError('network interrupted')
    return new Response(JSON.stringify({ data: newItem }), { status: 201 })
  }
  assert.equal(url.searchParams.has('active'), false, 'order must also receive inactive rows')
  return new Response(JSON.stringify({ data: reads, meta: { pagination: { page: 1, perPage: 1000 } } }))
}) as typeof fetch

setActivePinia(createPinia())
invalidate('/api/items')
const store = useItemsStore()
const payload = { category: 'Clothing', subcategory: 'Tops', itemType: ' Shirt ', displayNameTh: 'เสื้อ' }
try {
  await store.load()
  assert.equal(store.items[0]?.active, false)
  await store.create(payload)
  assert.deepEqual(store.items.find((item) => item.id === newItem.id), newItem)
  await store.load()
  assert.ok(store.items.some((item) => item.id === newItem.id), 'lagging GET must retain confirmed create')
  reads = [oldItem, newItem]
  invalidate('/api/items')
  await store.load()
  assert.equal(store.items.filter((item) => item.id === newItem.id).length, 1)
  reads = [{ ...oldItem, displayNameTh: 'ชื่อใหม่จากการแก้ไข' }, newItem]
  invalidate('/api/items')
  await store.load()
  assert.equal(store.items.find((item) => item.id === oldItem.id)?.displayNameTh, 'ชื่อใหม่จากการแก้ไข',
    'resource invalidation must refresh an already loaded picker')
  failPost = true
  await assert.rejects(() => store.create(payload), /network interrupted/)
  assert.equal(posts, 2, 'unknown write outcome must not auto-retry')
  assert.equal(store.items.length, 2, 'failed writes must not insert optimistic rows')
} finally {
  store.$dispose()
  globalThis.fetch = originalFetch
}
console.log('items master service/store tests passed')
