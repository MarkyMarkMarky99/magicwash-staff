import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import ts from 'typescript'
import * as vue from 'vue'

const source = readFileSync(new URL('../../../../../src/features/laundry-items/composables/useLaundryItemPhotoCapture.ts', import.meta.url), 'utf8')
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText

type Status = 'uploading' | 'done' | 'failed'
interface Request { photoType: string, orderId: string | null, imageUrls: string[] }
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
  t.capture.add(t.file(), 'DEFECT')
  t.capture.add(t.file(), 'DEFECT')
  t.capture.add(t.file(), 'DEFECT')
  assert.deepEqual(t.capture.items.value.map(item => [item.id, item.status]), [['garment-photo-3', 'uploading'], ['garment-photo-2', 'uploading'], ['garment-photo-1', 'uploading']], 'newest first, each capture uploads at once')
  const finishing = t.capture.finish()
  assert.equal(t.capture.saving.value, true)
  t.settle('garment-photo-1', 'done')
  await tick()
  assert.equal(t.saves.length, 0, 'waits until every upload has settled')
  t.settle('garment-photo-2', 'done')
  t.settle('garment-photo-3', 'done')
  await finishing
  assert.equal(t.saves.length, 1, 'one save request for the whole session')
  assert.deepEqual(t.saves[0], { photoType: 'DEFECT', orderId: 'ORD-1', imageUrls: ['garment-photo-1', 'garment-photo-2', 'garment-photo-3'].map(url) })
  assert.equal(t.capture.saving.value, false)
  assert.equal(t.capture.items.value.length, 0)
  assert.equal(t.capture.problems.value.length, 0)
  assert.deepEqual(t.forgotten.sort(), ['garment-photo-1', 'garment-photo-2', 'garment-photo-3'])
  assert.equal(t.removed.length, 0, 'saved files are never deleted')
  t.scope.stop()
  assert.equal(t.removed.length, 0, 'leaving the page keeps saved files')
}

{
  const t = setup(null)
  t.capture.add(t.file(), 'BEFORE')
  t.capture.add(t.file(), 'BEFORE')
  t.settle('garment-photo-1', 'done')
  t.settle('garment-photo-2', 'failed')
  await t.capture.finish()
  assert.equal(t.saves.length, 1)
  assert.deepEqual(t.saves[0].imageUrls, [url('garment-photo-1')])
  assert.equal(t.saves[0].orderId, null)
  assert.equal(t.capture.problems.value.length, 1)
  assert.deepEqual([t.capture.problems.value[0].kind, t.capture.problems.value[0].message], ['upload', '1 photo did not upload.'])
  assert.deepEqual(t.capture.items.value.map(item => [item.id, item.status]), [['garment-photo-2', 'failed']])
  const retrying = t.capture.retry(t.capture.problems.value[0])
  assert.equal(t.capture.problems.value[0].busy, true)
  assert.equal(t.uploads['garment-photo-2'].status, 'uploading')
  t.settle('garment-photo-2', 'done')
  await retrying
  assert.equal(t.saves.length, 2, 'retried uploads are saved in one more request')
  assert.deepEqual(t.saves[1].imageUrls, [url('garment-photo-2')])
  assert.equal(t.capture.problems.value.length, 0)
  assert.equal(t.removed.length, 0)
}

{
  const t = setup()
  t.capture.add(t.file(), 'AFTER')
  t.capture.add(t.file(), 'AFTER')
  t.settle('garment-photo-1', 'failed')
  t.settle('garment-photo-2', 'failed')
  await t.capture.finish()
  assert.equal(t.saves.length, 0, 'nothing uploaded means no request')
  assert.equal(t.capture.problems.value[0].message, '2 photos did not upload.')
  t.capture.dismiss(t.capture.problems.value[0])
  assert.equal(t.capture.problems.value.length, 0)
  assert.equal(t.capture.items.value.length, 0)
  assert.deepEqual(t.removed.sort(), ['garment-photo-1', 'garment-photo-2'])
}

{
  const t = setup()
  t.setBehaviour(async () => { throw new Error('Garment is not in this order') })
  t.capture.add(t.file(), 'DEFECT')
  t.settle('garment-photo-1', 'done')
  await t.capture.finish()
  assert.equal(t.capture.problems.value.length, 1)
  const problem = t.capture.problems.value[0]
  assert.deepEqual([problem.kind, problem.message], ['save', 'Garment is not in this order'])
  assert.equal(t.removed.length, 0, 'uploaded files stay while a retry is possible')
  assert.equal(t.capture.items.value.length, 1)
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
  t.capture.add(t.file(), 'DEFECT')
  t.settle('garment-photo-1', 'done')
  await t.capture.finish()
  t.capture.dismiss(t.capture.problems.value[0])
  assert.deepEqual(t.removed, ['garment-photo-1'], 'dismissing a failed save deletes the files')
  assert.equal(t.capture.items.value.length, 0)
}

{
  const t = setup()
  t.capture.add(t.file(), 'DEFECT')
  t.capture.add(t.file(), 'DEFECT')
  t.settle('garment-photo-1', 'done')
  t.scope.stop()
  assert.deepEqual(t.removed.sort(), ['garment-photo-1', 'garment-photo-2'], 'leaving with unsaved uploads deletes their files')
}

{
  const t = setup()
  let finishSave!: () => void
  t.setBehaviour(() => new Promise<void>(resolve => { finishSave = resolve }))
  t.capture.add(t.file(), 'DEFECT')
  t.settle('garment-photo-1', 'done')
  const finishing = t.capture.finish()
  await tick()
  t.scope.stop()
  assert.equal(t.removed.length, 0, 'a save in flight keeps its files')
  finishSave()
  await finishing
  assert.deepEqual(t.forgotten, ['garment-photo-1'])
  assert.equal(t.removed.length, 0)
}

{
  const t = setup()
  await t.capture.finish()
  assert.equal(t.saves.length, 0, 'closing the camera without photos saves nothing')
}
console.log('laundry item photo capture dry tests passed')
