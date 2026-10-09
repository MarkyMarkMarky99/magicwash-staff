import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { computed, effectScope, nextTick, ref, watch } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { transpileModule, ScriptTarget, ModuleKind } from 'typescript'
import { useJobTicketStore } from '@/data/job-tickets/job-ticket.store'
import { loadPackagingOrder } from '@/features/job-tickets/packaging-bag-source'
import * as packaging from '@/features/job-tickets/packaging-bags'
import { invalidate } from '@/shared/api/response-cache'

const source = readFileSync(new URL('../../../../../src/features/job-tickets/composables/usePackagingBags.ts', import.meta.url), 'utf8')
const script = source.replace(/^import[\s\S]*?from ['"][^'"]+['"]\r?\n/gm, '').replace('export function', 'function')
const code = transpileModule(script, { compilerOptions: { target: ScriptTarget.ES2022, module: ModuleKind.ESNext } }).outputText
setActivePinia(createPinia())
const store = useJobTicketStore()
const job = (id: string, department = 'Packaging', status = 'Pending', stepNo = 3) => ({
  id, orderId: 'order-1', customerId: 'customer-1', laundryItemId: id === 'blocked' ? 'tag-1' : id,
  scope: 'ITEM', department, status, stepNo, deletedAt: null, photoEvidenceUrl: null,
})
store.rows.set('tag-2', job('tag-2') as any)
store.rows.set('tag-1', job('tag-1') as any)
let finish!: () => void
let gate = new Promise<void>(resolve => { finish = resolve })
let fail = false
let reads = 0
let activate!: () => void
let deactivate!: () => void
let unmount!: () => void
const originalFetch = globalThis.fetch
globalThis.fetch = (async input => {
  const url = new URL(String(input), 'http://localhost')
  if (url.pathname === '/api/job-tickets') {
    reads += 1
    assert.equal(url.searchParams.get('orderId'), 'order-1')
    assert.equal(url.searchParams.has('department'), false)
    assert.equal(url.searchParams.get('perPage'), '500')
    await gate
    if (fail) return Response.json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Offline' } }, { status: 500 })
  }
  assert.notEqual(url.pathname, '/api/order-images')
  const data = url.pathname === '/api/job-tickets'
    ? [job('tag-1'), job('tag-2'), job('old-completed', 'Packaging', 'Completed'), job('blocked', 'Ironing', 'Pending', 2)] : []
  return Response.json({ success: true, data, meta: { pagination: { page: 1, perPage: 500 } } })
}) as typeof fetch
const memory = new Map<string, string>([['magicwash.packaging-bags.order-1', JSON.stringify([{ id: 'bag-a', garmentTagIds: [], photoUrl: 'https://photo/a' }])]])
const dependencies = {
  ...packaging, computed, ref, watch, useJobTicketStore, loadPackagingOrder,
  generateShortId: () => 'bag-new',
  uploadToStorage: async () => 'https://photo/upload', confirmPackagingBags: async () => ({ bags: [] }), currentActor: () => 'staff-1',
  onBeforeUnmount: (callback: () => void) => { unmount = callback }, onActivated: (callback: () => void) => { activate = callback }, onDeactivated: (callback: () => void) => { deactivate = callback },
  localStorage: { getItem: (key: string) => memory.get(key) ?? null, setItem: (key: string, value: string) => memory.set(key, value), removeItem: (key: string) => memory.delete(key) },
}
const scope = effectScope()
const state = scope.run(() => new Function(...Object.keys(dependencies), `${code}; return usePackagingBags(() => 'order-1')`)(...Object.values(dependencies)))!
try {
  const pending = state.load()
  assert.deepEqual(state.order.value.garments.map((row: any) => row.tagId), ['tag-1', 'tag-2'])
  assert.equal(state.loading.value, true)
  assert.equal(state.ticketsLoading.value, true)
  state.toggle('bag-a', 'tag-2')
  assert.deepEqual(state.bags.value[0].garmentTagIds, [])
  assert.equal(state.scan('bag-a', 'tag-2'), null)
  assert.equal(state.confirmable.value, false)
  finish()
  await pending
  await nextTick()
  assert.equal(state.ticketsLoading.value, false)
  assert.deepEqual(state.order.value.garments.map((row: any) => row.tagId), ['old-completed', 'tag-1', 'tag-2'])
  assert.equal(state.order.value.garments.find((row: any) => row.tagId === 'tag-1').waitingFor, 'Ironing')
  assert.equal(state.scan('bag-a', 'tag-1').success, false)
  assert.equal(state.scan('bag-a', 'tag-2').success, true)
  assert.equal(state.confirmable.value, true)
  store.rows.get('blocked')!.status = 'Completed'
  await nextTick()
  assert.equal(state.order.value.garments.find((row: any) => row.tagId === 'tag-1').waitingFor, null)
  assert.equal(state.scan('bag-a', 'tag-1').success, true)
  gate = new Promise<void>(resolve => { finish = resolve })
  invalidate('/api/job-tickets')
  assert.equal(state.ticketsLoading.value, true)
  assert.equal(state.scan('bag-a', 'old-completed'), null)
  assert.equal(state.confirmable.value, false)
  fail = true
  finish()
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(state.ticketsLoading.value, true)
  assert.ok(store.orderView('order-1').error)
  const beforeHidden = reads
  deactivate()
  invalidate('/api/job-tickets')
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(reads, beforeHidden)
  fail = false
  activate()
  invalidate('/api/job-tickets')
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(reads, beforeHidden + 1)
  assert.equal(state.ticketsLoading.value, false)
  unmount()
  invalidate('/api/job-tickets')
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(reads, beforeHidden + 1)
  const sheet = readFileSync(new URL('../../../../../src/features/job-tickets/components/PackagingBagSheet.vue', import.meta.url), 'utf8')
  assert.match(sheet, /:disabled="loading \|\| blockedLabel\(state\) !== null"/)
  assert.match(sheet, /loading \|\| blockedLabel\(state\) \? 'opacity-40 saturate-0'/)
  console.log('packaging-store-preview.dry-test: OK (cached preview, full-order gating, shared updates, invalidation, error gate, disabled style)')
} finally {
  scope.stop()
  store.$dispose()
  globalThis.fetch = originalFetch
}
