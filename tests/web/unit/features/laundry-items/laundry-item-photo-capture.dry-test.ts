import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import ts from 'typescript'
import * as vue from 'vue'

const source = readFileSync(new URL('../../../../../src/features/laundry-items/composables/useLaundryItemPhotoCapture.ts', import.meta.url), 'utf8')
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText

type Status = 'uploading' | 'done' | 'failed'
interface Request { photoType: string, orderId: string | null, imageUrl: string }
type Capture = ReturnType<typeof import('@/features/laundry-items/composables/useLaundryItemPhotoCapture').useLaundryItemPhotoCapture>

function setup(orderId: string | null = 'ORD-1') {
  const uploads = vue.reactive<Record<string, { status: Status, url: string | null }>>({})
  const removed: string[] = []
  const forgotten: string[] = []
  const fake = {
    uploads,
    start: (id: string) => { uploads[id] = { status: 'uploading', url: null } },
    retry: (id: string) => { if (uploads[id]?.status === 'failed') uploads[id] = { status: 'uploading', url: null } },
    remove: (id: string) => { removed.push(id); delete uploads[id] },
    forget: (id: string) => { forgotten.push(id); delete uploads[id] },
  }
  const saves: Request[] = []
  let behaviour: (request: Request) => Promise<void> = async () => {}
  const scope = vue.effectScope()
  const exports = {} as { useLaundryItemPhotoCapture: (options: unknown) => Capture }
  new Function('require', 'exports', compiled)((id: string) => {
    if (id === 'vue') return vue
    if (id === '@/shared/composables/useGarmentPhotoUploads') return { useGarmentPhotoUploads: () => fake }
    throw new Error(`Unexpected import: ${id}`)
  }, exports)
  const capture = scope.run(() => exports.useLaundryItemPhotoCapture({
    orderId: () => orderId,
    save: (request: Request) => { saves.push(request); return behaviour(request) },
  }))!
  const file = () => new File(['x'], 'photo.jpg', { type: 'image/jpeg' })
  const settle = (id: string, status: 'done' | 'failed') => { uploads[id] = { status, url: status === 'done' ? `https://firebasestorage.googleapis.com/${id}` : null } }
  return { capture, uploads, saves, removed, forgotten, scope, file, settle, setBehaviour: (next: typeof behaviour) => { behaviour = next } }
}
const tick = () => new Promise(resolve => setTimeout(resolve, 0))
const url = (id: string) => `https://firebasestorage.googleapis.com/${id}`

{
  const t = setup()
  const adding = t.capture.add(t.file(), 'DEFECT')
  assert.deepEqual(t.capture.items.value.map(item => [item.id, item.status]), [['garment-photo-1', 'uploading']], 'the capture shows at once, uploading')
  assert.equal(t.capture.saving.value, true)
  await tick()
  assert.equal(t.saves.length, 0, 'nothing is saved before the upload is done')
  t.settle('garment-photo-1', 'done')
  await adding
  assert.equal(t.saves.length, 1, 'one save call for the photo')
  assert.deepEqual(t.saves[0], { photoType: 'DEFECT', orderId: 'ORD-1', imageUrl: url('garment-photo-1') })
  assert.equal(t.capture.saving.value, false)
  assert.equal(t.capture.items.value.length, 0)
  assert.equal(t.capture.problems.value.length, 0)
  assert.deepEqual(t.forgotten, ['garment-photo-1'])
  assert.equal(t.removed.length, 0, 'saved files are never deleted')
  t.scope.stop()
  assert.equal(t.removed.length, 0, 'leaving the page keeps saved files')
}

{
  const t = setup(null)
  const first = t.capture.add(t.file(), 'BEFORE')
  const second = t.capture.add(t.file(), 'AFTER')
  assert.deepEqual(t.capture.items.value.map(item => item.id), ['garment-photo-2', 'garment-photo-1'], 'newest first')
  t.settle('garment-photo-2', 'done')
  await second
  assert.equal(t.saves.length, 1, 'photos are independent')
  assert.deepEqual(t.saves[0], { photoType: 'AFTER', orderId: null, imageUrl: url('garment-photo-2') })
  assert.equal(t.capture.saving.value, true, 'still saving while the other photo uploads')
  t.settle('garment-photo-1', 'done')
  await first
  assert.equal(t.saves.length, 2)
  assert.equal(t.saves[1].photoType, 'BEFORE')
  assert.equal(t.capture.saving.value, false)
}

{
  const t = setup(null)
  const adding = t.capture.add(t.file(), 'BEFORE')
  t.settle('garment-photo-1', 'failed')
  await adding
  assert.equal(t.saves.length, 0, 'a failed upload is not saved')
  assert.equal(t.capture.problems.value.length, 1)
  assert.deepEqual([t.capture.problems.value[0].kind, t.capture.problems.value[0].message], ['upload', 'Photo did not upload.'])
  assert.deepEqual(t.capture.items.value.map(item => [item.id, item.status]), [['garment-photo-1', 'failed']])
  const retrying = t.capture.retry(t.capture.problems.value[0])
  assert.equal(t.capture.problems.value[0].busy, true)
  assert.equal(t.uploads['garment-photo-1'].status, 'uploading')
  t.settle('garment-photo-1', 'done')
  await retrying
  assert.equal(t.saves.length, 1, 'a retried upload is saved with one call')
  assert.equal(t.saves[0].orderId, null)
  assert.equal(t.capture.problems.value.length, 0)
  assert.equal(t.removed.length, 0)
}

{
  const t = setup()
  const adding = t.capture.add(t.file(), 'AFTER')
  t.settle('garment-photo-1', 'failed')
  await adding
  t.capture.dismiss(t.capture.problems.value[0])
  assert.equal(t.capture.problems.value.length, 0)
  assert.equal(t.capture.items.value.length, 0)
  assert.deepEqual(t.removed, ['garment-photo-1'])
}

{
  const t = setup()
  t.setBehaviour(async () => { throw new Error('Garment is not in this order') })
  const adding = t.capture.add(t.file(), 'DEFECT')
  t.settle('garment-photo-1', 'done')
  await adding
  assert.equal(t.capture.problems.value.length, 1)
  const problem = t.capture.problems.value[0]
  assert.deepEqual([problem.kind, problem.message], ['save', 'Garment is not in this order'])
  assert.equal(t.removed.length, 0, 'the uploaded file stays while a retry is possible')
  assert.equal(t.capture.items.value.length, 1)
  assert.equal(t.capture.saving.value, false)
  t.setBehaviour(async () => {})
  await t.capture.retry(problem)
  assert.equal(t.saves.length, 2)
  assert.deepEqual(t.saves[1], t.saves[0], 'retry resends the same request')
  assert.equal(t.capture.problems.value.length, 0)
  assert.equal(t.capture.items.value.length, 0)
  assert.equal(t.removed.length, 0)
}

{
  const t = setup()
  t.setBehaviour(async () => { throw new Error('boom') })
  const adding = t.capture.add(t.file(), 'DEFECT')
  t.settle('garment-photo-1', 'done')
  await adding
  t.capture.dismiss(t.capture.problems.value[0])
  assert.deepEqual(t.removed, ['garment-photo-1'], 'dismissing a failed save deletes the file')
  assert.equal(t.capture.items.value.length, 0)
}

{
  const t = setup()
  const adding = t.capture.add(t.file(), 'DEFECT')
  t.capture.add(t.file(), 'DEFECT')
  t.settle('garment-photo-1', 'done')
  await adding
  t.scope.stop()
  assert.deepEqual(t.removed, ['garment-photo-2'], 'leaving with an unsaved upload deletes its file')
  await tick()
  assert.equal(t.saves.length, 1, 'a photo released on leaving is never saved')
}

{
  const t = setup()
  let finishSave!: () => void
  t.setBehaviour(() => new Promise<void>(resolve => { finishSave = resolve }))
  const adding = t.capture.add(t.file(), 'DEFECT')
  t.settle('garment-photo-1', 'done')
  await tick()
  t.scope.stop()
  assert.equal(t.removed.length, 0, 'a save in flight keeps its file')
  finishSave()
  await adding
  assert.deepEqual(t.forgotten, ['garment-photo-1'])
  assert.equal(t.removed.length, 0)
}
console.log('laundry item photo capture dry tests passed')
