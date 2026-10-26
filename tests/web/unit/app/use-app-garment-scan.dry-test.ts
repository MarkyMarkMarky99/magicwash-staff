import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { computed, effectScope, onScopeDispose, ref, watch } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import { ScriptTarget, transpileModule } from 'typescript'
import { laundryTagIdSchema } from '@contracts/laundry-tag-prints/laundry-tag-print.schema'
import { anyPageGarmentScan } from '@/shared/utils/scan-code'

const source = readFileSync(new URL('../../../../src/app/composables/useAppGarmentScan.ts', import.meta.url), 'utf8')
const script = source.replace(/^import .*$/gm, '').replace('export function', 'function')
const code = transpileModule(script, { compilerOptions: { target: ScriptTarget.ES2022 } }).outputText
const tick = () => new Promise(resolve => setImmediate(resolve))

async function harness(path = '/form?keep=yes') {
  const history = createMemoryHistory()
  const router = createRouter({ history, routes: [
    { path: '/form', component: {} }, { path: '/other', component: {} },
    { path: '/public', component: {}, meta: { public: true } },
    { path: '/work', component: {}, meta: { ownsWorkScan: true } },
  ] })
  await router.push(path)
  const signedIn = ref(true)
  const lookups: string[] = []
  let lookup = async (_id: string): Promise<unknown> => ({ deletedAt: null })
  const scope = effectScope()
  const dependencies = {
    computed, onScopeDispose, ref, watch, laundryTagIdSchema, anyPageGarmentScan,
    useRoute: () => new Proxy({}, { get: (_target, key) => Reflect.get(router.currentRoute.value, key) }),
    useRouter: () => router,
    getLaundryItem: (id: string) => { lookups.push(id); return lookup(id) },
    setTimeout: () => 1, clearTimeout: () => {},
  }
  const scan = scope.run(() => new Function(...Object.keys(dependencies), `${code}; return useAppGarmentScan(arguments[arguments.length - 1]);`)(...Object.values(dependencies), () => signedIn.value))!
  return { scan, router, history, scope, lookups, signedIn, setLookup: (next: typeof lookup) => { lookup = next } }
}

const app = await harness()
assert.equal(app.lookups.length, 0)
for (const code of ['Ab12Cd34', 'MWB-Ab12Cd34', 'MWS-card', 'MWO-Ab12Cd34']) await app.scan.scan(code)
assert.equal(app.lookups.length, 0)
await app.scan.scan('MWG-Ab12Cd34')
assert.deepEqual(app.lookups, ['Ab12Cd34'])
assert.equal(app.scan.tagId.value, 'Ab12Cd34')
assert.equal(app.router.currentRoute.value.query.keep, 'yes')
await app.scan.scan('mwg-Zz12Cd34')
assert.equal(app.scan.tagId.value, 'Zz12Cd34')
app.scan.close()
await tick()
assert.equal(app.router.currentRoute.value.fullPath, '/form?keep=yes')
assert.equal(app.scan.tagId.value, null)
app.setLookup(async () => null)
await app.scan.scan('MWG-Ab12Cd34')
assert.equal(app.scan.notice.value, 'Tag not registered')
assert.equal(app.scan.tagId.value, null)
app.setLookup(async () => { throw new Error('offline') })
await app.scan.scan('MWG-Ab12Cd34')
assert.equal(app.scan.notice.value, 'Could not check tag. Try again.')
let release!: (value: unknown) => void
app.setLookup(() => new Promise(resolve => { release = resolve }))
const pending = app.scan.scan('MWG-Ab12Cd34')
await app.router.push('/other')
release({ deletedAt: null })
await pending
assert.equal(app.scan.tagId.value, null)
for (const path of ['/public', '/work']) {
  await app.router.push(path)
  const before = app.lookups.length
  await app.scan.scan('MWG-Ab12Cd34')
  assert.equal(app.lookups.length, before)
  assert.equal(app.scan.enabled.value, false)
}
await app.router.push('/form')
app.signedIn.value = false
const before = app.lookups.length
await app.scan.scan('MWG-Ab12Cd34')
assert.equal(app.lookups.length, before)
app.scope.stop()

const deep = await harness('/form?keep=yes&scannedGarment=Ab12Cd34')
assert.equal(deep.scan.tagId.value, 'Ab12Cd34')
assert.equal(deep.lookups.length, 0)
deep.scan.close()
await tick()
assert.equal(deep.router.currentRoute.value.fullPath, '/form?keep=yes')
deep.router.back()
await tick()
assert.equal(deep.router.currentRoute.value.fullPath, '/form?keep=yes')
await deep.scan.scan('MWG-Ab12Cd34')
await deep.router.push('/other')
assert.equal(deep.router.currentRoute.value.fullPath, '/other')
deep.router.back()
await tick()
assert.equal(deep.router.currentRoute.value.fullPath, '/form?keep=yes')
deep.scope.stop()
console.log('use-app-garment-scan.dry-test: OK')
