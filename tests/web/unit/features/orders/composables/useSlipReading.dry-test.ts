import assert from 'node:assert/strict'
import test from 'node:test'
import { effectScope } from 'vue'
import { useSlipReading } from '@/features/orders/composables/useSlipReading'
import { jsonResponse, slipResult, successEnvelope } from '../../../../../shared/ai-gateway/read-slip.fixture'

const options = { baseUrl: 'http://stub.invalid', getToken: async () => null, prepareFile: async (file: Blob) => file }
const health = () => jsonResponse({ ok: true, codexReady: true, busy: false, queued: 0 })
const file = new Blob(['photo'])

test('disabled when base URL is null: idle and no fetch or preparation', async () => {
  const reading = useSlipReading({ ...options, baseUrl: null,
    fetchImpl: async () => { assert.fail('must not fetch') }, prepareFile: async () => { assert.fail('must not prepare') },
  })
  await reading.read(file, 'CRYO')
  assert.equal(reading.status.value, 'idle')
})

test('health unreachable or codex not ready is unavailable without task call', async () => {
  for (const ready of [null, false]) {
    let calls = 0
    const reading = useSlipReading({ ...options, fetchImpl: async () => {
      calls += 1
      if (ready === null) throw new Error('offline')
      return jsonResponse({ ok: true, codexReady: false, busy: false, queued: 0 })
    } })
    await reading.read(file, 'CRYO')
    assert.equal(reading.status.value, 'unavailable')
    assert.equal(calls, 1)
  }
})

test('successful read prepares file then exposes result and warnings', async () => {
  let prepared = false
  const reading = useSlipReading({ ...options, prepareFile: async () => { prepared = true; return new Blob(['small']) },
    fetchImpl: async (url, init) => {
      if (String(url).endsWith('/health')) return health()
      assert.equal(prepared, true)
      assert.ok(init?.body instanceof FormData)
      assert.equal(await (init.body.get('file0') as Blob).text(), 'small')
      return jsonResponse(successEnvelope())
    },
  })
  const pending = reading.read(file, 'CRYO')
  assert.equal(reading.status.value, 'reading')
  await pending
  assert.equal(reading.status.value, 'done')
  assert.deepEqual(reading.result.value, slipResult)
  assert.deepEqual(reading.warnings.value, slipResult.warnings)
})

test('gateway and image preparation errors are failed, preserving the error message', async () => {
  for (const preparationFails of [false, true]) {
    const reading = useSlipReading({ ...options,
      prepareFile: async (file) => { if (preparationFails) throw new Error('Bad photo'); return file },
      fetchImpl: async (url) => String(url).endsWith('/health') ? health() : jsonResponse({
        ok: false, requestId: null, task: 'read-slip', error: { code: 'BUSY', message: 'Gateway busy' },
      }, 503),
    })
    await reading.read(file, 'CRYO')
    assert.equal(reading.status.value, 'failed')
    assert.equal(reading.error.value, preparationFails ? 'Bad photo' : 'Gateway busy')
    assert.equal(reading.result.value, null)
  }
})

test('new generation aborts older request and ignores its late response', async () => {
  let resolveOld!: (response: Response) => void
  let oldSignal: AbortSignal | null | undefined
  let started!: () => void
  const firstStarted = new Promise<void>((resolve) => { started = resolve })
  let tasks = 0
  const reading = useSlipReading({ ...options, fetchImpl: async (url, init) => {
    if (String(url).endsWith('/health')) return health()
    tasks += 1
    if (tasks === 1) {
      oldSignal = init?.signal
      started()
      return new Promise<Response>((resolve) => { resolveOld = resolve })
    }
    return jsonResponse(successEnvelope({ ...slipResult, priceGroup: 'NEW' }))
  } })
  const oldRead = reading.read(file, 'OLD')
  await firstStarted
  await reading.read(file, 'NEW')
  assert.equal(oldSignal?.aborted, true)
  resolveOld(jsonResponse(successEnvelope({ ...slipResult, priceGroup: 'OLD' })))
  await oldRead
  assert.equal(reading.status.value, 'done')
  assert.equal(reading.result.value?.priceGroup, 'NEW')
})

test('cancel and scope disposal abort reading and ignore pending health', async () => {
  for (const unmount of [false, true]) {
    const scope = effectScope()
    let signal: AbortSignal | null | undefined
    let resolveHealth!: (response: Response) => void
    const reading = scope.run(() => useSlipReading({ ...options, fetchImpl: async (_, init) => {
      signal = init?.signal
      return new Promise<Response>((resolve) => { resolveHealth = resolve })
    } }))!
    const pending = reading.read(file, 'CRYO')
    if (unmount) scope.stop()
    else reading.cancel()
    resolveHealth(health())
    await pending
    assert.equal(signal?.aborted, true)
    assert.equal(reading.status.value, 'idle')
    assert.equal(reading.result.value, null)
    scope.stop()
  }
})
