import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import ts from 'typescript'
import { computed, ref } from 'vue'
import { laundryItemRegisterRequestSchema } from '../../../../../contracts/laundry-items/laundry-item-register-api.schema.js'

const source = readFileSync(new URL('../../../../../src/features/laundry-items/pages/LaundryItemRegisterPage.vue', import.meta.url), 'utf8')
const script = source.match(/<script setup lang="ts">([\s\S]*?)<\/script>/)![1]
const compiled = ts.transpileModule(`${script}\nexport { save, saving, canSave, saveNotice, discard, removeRow }`, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText
class ApiError extends Error {
  constructor(message: string, readonly status: number, readonly code: string) { super(message) }
}
type Result = { registered: string[], alreadyRegistered: string[], failed: string[], aiTriggered: boolean }
function setup(register: (payload: unknown) => Promise<Result>) {
  let closes = 0
  let deletions = 0
  let removals = 0
  let calls = 0
  let unmount = () => {}
  let leave = () => true
  const modules: Record<string, unknown> = {
    vue: { computed, ref, nextTick: () => Promise.resolve(), watch: () => {}, onMounted: () => {}, onBeforeUnmount: (fn: () => void) => { unmount = fn } },
    pinia: { storeToRefs: () => ({ customers: ref([]), loaded: ref(true), error: ref(null) }) },
    'vue-router': { useRoute: () => ({ params: { customerId: 'customer-1' } }), onBeforeRouteLeave: (fn: () => boolean) => { leave = fn } },
    '@contracts/laundry-items/laundry-item-register-api.schema': { laundryItemRegisterRequestSchema },
    '@/shared/api/api-client': { ApiError },
    '@/shared/navigation/use-close-route': { useCloseRoute: () => ({ close: () => { closes++ } }) },
    '@/shared/composables/useGarmentPhotoUploads': { useGarmentPhotoUploads: () => ({
      uploads: { draft1: { status: 'done', url: 'https://example.test/photo.jpg' } },
      discardAll: () => { deletions++ }, remove: () => { deletions++ },
    }) },
    '@/data/customers/customer.store': { useCustomerStore: () => ({}) },
    '@/data/laundry-items/laundry-item.service': { registerLaundryItems: (payload: unknown) => { calls++; return register(payload) } },
    '@/features/laundry-items/composables/useLaundryItemRegisterDraft': { useLaundryItemRegisterDraft: () => ({
      garments: [{ id: 'draft1', tag: 'new00001', previewUrl: 'blob:photo' }],
      removeGarment: () => { removals++ },
    }) },
    '@/features/laundry-items/composables/useLaundryItemRegisterGarments': { useLaundryItemRegisterGarments: () => ({}) },
    '@/features/laundry-items/composables/useLaundryItemRegisterOverlayRoute': { useLaundryItemRegisterOverlayRoute: () => ({ overlay: ref(null) }) },
  }
  const exports = {} as {
    save: () => Promise<void>
    saving: { value: boolean }
    canSave: { value: boolean }
    saveNotice: { value: string | null }
    discard: () => void
    removeRow: (id: string) => void
  }
  new Function('require', 'exports', 'defineOptions', compiled)((id: string) => {
    if (id in modules) return modules[id]
    if (id.endsWith('.vue') || id === '@/shared/utils/scan-feedback') return {}
    throw new Error(`Unexpected import: ${id}`)
  }, exports, () => {})
  return { page: exports, unmount: () => unmount(), leave: () => leave(), counts: () => ({ closes, deletions, removals, calls }) }
}
const success: Result = { registered: ['new00001'], alreadyRegistered: [], failed: [], aiTriggered: true }
{
  let resolve!: (result: Result) => void
  const t = setup(async payload => {
    assert.deepEqual(payload, { customerId: 'customer-1', garments: [{ tag: 'new00001', imageUrl: 'https://example.test/photo.jpg', itemId: null }] })
    return new Promise<Result>(done => { resolve = done })
  })
  const pending = t.page.save()
  assert.equal(t.page.saving.value, true)
  assert.equal(t.page.canSave.value, false)
  assert.equal(t.leave(), false)
  await t.page.save()
  t.page.discard(); t.page.removeRow('draft1')
  assert.deepEqual(t.counts(), { closes: 0, deletions: 0, removals: 0, calls: 1 })
  resolve(success)
  await pending
  assert.equal(t.page.saveNotice.value, '1 registered')
  assert.equal(t.page.saving.value, false)
  assert.equal(t.leave(), true)
  t.unmount()
  assert.equal(t.counts().closes, 1)
  assert.equal(t.counts().deletions, 0)
}
{
  const t = setup(async () => ({ ...success, alreadyRegistered: ['same0001'], failed: ['new00001'] }))
  await t.page.save()
  assert.equal(t.page.saveNotice.value, '1 registered, 1 already registered, 1 photo rows failed')
  assert.equal(t.counts().closes, 0)
  assert.equal(t.page.canSave.value, true)
  t.page.removeRow('draft1'); t.page.discard(); t.unmount()
  assert.equal(t.counts().deletions, 0)
}
for (const error of [new ApiError('Tag belongs to another customer: other001', 409, 'TAG_CONFLICT'), new Error('Network failed')]) {
  const t = setup(async () => { throw error })
  await t.page.save()
  assert.equal(t.page.saveNotice.value, error.message)
  assert.equal(t.page.canSave.value, true)
  assert.equal(t.counts().closes, 0)
  assert.equal(t.counts().deletions, 0)
  t.unmount()
  assert.equal(t.counts().deletions, 1)
}
console.log('laundry-item register Save dry tests passed')
