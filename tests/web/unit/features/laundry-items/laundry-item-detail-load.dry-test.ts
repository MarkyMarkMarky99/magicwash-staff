import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import ts from 'typescript'
import * as vue from 'vue'
import { laundryTagIdSchema } from '@contracts/laundry-tag-prints/laundry-tag-print.schema'
import { laundryItemResponseSchema } from '@contracts/laundry-items/laundry-item-api.schema'

const source = readFileSync(new URL('../../../../../src/features/laundry-items/composables/useLaundryItemDetail.ts', import.meta.url), 'utf8')
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
type Detail = ReturnType<typeof import('@/features/laundry-items/composables/useLaundryItemDetail').useLaundryItemDetail>
const row = (id = 'Ab12Cd34') => laundryItemResponseSchema.parse({ id, customerId: 'customer', itemId: null, washProgram: null, notes: null, imageUrl: null, createdAt: '2026-10-27 09:00:00', createdBy: 'staff', updatedAt: null, updatedBy: null, deletedAt: null, deletedBy: null })
function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: Error) => void
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}
const tick = () => new Promise(resolve => setImmediate(resolve))
function setup(initial = true, referencesLoaded = true, prefetch = false) {
  const calls: string[] = []
  const photos = deferred<never[]>()
  const tickets = deferred<never[]>()
  const garment = deferred<ReturnType<typeof row>>()
  const items = vue.reactive({ items: referencesLoaded ? [{ id: 'item' }] : [], error: null, load: async () => { calls.push('items') } })
  const programs = { items: [], error: null, load: async () => { if (!referencesLoaded) calls.push('programs') } }
  const staff = { loaded: referencesLoaded, error: null, load: async () => { calls.push('staff') } }
  const customers = { customers: [], loadCustomers: () => { throw new Error('Customers must come from preload') } }
  const modules: Record<string, unknown> = {
    vue,
    '@contracts/laundry-tag-prints/laundry-tag-print.schema': { laundryTagIdSchema },
    '@/data/laundry-items/laundry-item.service': { getLaundryItem: () => { calls.push('garment'); return garment.promise }, updateLaundryItem: async () => row() },
    '@/data/laundry-item-photos/laundry-item-photo.service': { listLaundryItemPhotos: () => { calls.push('photos'); return photos.promise } },
    '@/data/job-tickets/job-ticket.store': { useJobTicketStore: () => ({ loadGarment: () => { calls.push('tickets'); return tickets.promise } }) },
    '@/data/items/items.store': { useItemsStore: () => items },
    '@/data/customers/customer.store': { useCustomerStore: () => customers },
    '@/data/wash-programs/wash-programs.store': { useWashProgramsStore: () => programs },
    '@/data/staff/staff.store': { useStaffStore: () => staff },
  }
  const exports = {} as { useLaundryItemDetail: typeof import('@/features/laundry-items/composables/useLaundryItemDetail').useLaundryItemDetail }
  new Function('require', 'exports', compiled)((id: string) => {
    assert.ok(id in modules, `Unexpected dependency: ${id}`)
    return modules[id]
  }, exports)
  const tag = vue.ref('Ab12Cd34')
  const scope = vue.effectScope()
  const detail: Detail = scope.run(() => exports.useLaundryItemDetail(() => tag.value, () => {}, () => initial ? row() : null, () => prefetch ? { photos: Promise.resolve([]), tickets: Promise.resolve([]) } : null))!
  return { detail, tag, scope, calls, photos, tickets, garment }
}
{
  const t = setup()
  assert.deepEqual(t.calls, ['photos', 'tickets'])
  assert.equal(t.detail.garment.value?.id, 'Ab12Cd34')
  assert.equal(t.detail.loading.value, false)
  assert.equal(t.detail.photosLoaded.value, false)
  assert.equal(t.detail.ticketsLoaded.value, false)
  t.photos.reject(new Error('photos offline'))
  t.tickets.resolve([])
  await tick()
  assert.equal(t.detail.error.value, null)
  assert.equal(t.detail.photoError.value, 'Unable to load garment photos')
  assert.equal(t.detail.ticketsLoaded.value, true)
  assert.equal(t.detail.garment.value?.id, 'Ab12Cd34')
  t.scope.stop()
}
{
  const t = setup(false, false)
  assert.deepEqual(t.calls, ['photos', 'tickets', 'items', 'programs', 'staff', 'garment'])
  assert.equal(t.detail.loading.value, true)
  t.garment.resolve(row())
  await tick()
  assert.equal(t.detail.loading.value, false)
  assert.equal(t.detail.garment.value?.id, 'Ab12Cd34')
  assert.equal(t.detail.ticketsLoaded.value, false)
  t.tickets.reject(new Error('tickets offline'))
  t.photos.resolve([])
  await tick()
  assert.equal(t.detail.ticketError.value, 'Unable to load garment orders')
  assert.equal(t.detail.photosLoaded.value, true)
  assert.equal(t.detail.error.value, null)
  t.scope.stop()
}
{
  const t = setup()
  t.tag.value = 'Zz12Cd34'
  await vue.nextTick()
  assert.equal(t.calls.filter(call => call === 'garment').length, 1, 'a supplied row for a different tag must not be reused')
  t.garment.resolve(row('Zz12Cd34'))
  await tick()
  assert.equal(t.detail.garment.value?.id, 'Zz12Cd34')
  t.scope.stop()
  t.photos.resolve([])
  t.tickets.resolve([])
  await tick()
  assert.equal(t.detail.photosLoaded.value, false, 'disposed requests must not update state')
  assert.equal(t.detail.ticketsLoaded.value, false)
}
{
  const t = setup(false)
  t.tag.value = 'invalid'
  await vue.nextTick()
  t.garment.resolve(row())
  t.photos.resolve([])
  t.tickets.resolve([])
  await tick()
  assert.equal(t.detail.garment.value, null)
  assert.equal(t.detail.error.value, 'Invalid garment tag')
  assert.equal(t.detail.photosLoaded.value, false)
  assert.equal(t.detail.ticketsLoaded.value, false)
  t.scope.stop()
}
{
  const t = setup(true, true, true)
  await tick()
  assert.deepEqual(t.calls, [])
  assert.equal(t.detail.photosLoaded.value, true)
  assert.equal(t.detail.ticketsLoaded.value, true)
  t.scope.stop()
}
console.log('laundry-item-detail-load.dry-test: OK')
