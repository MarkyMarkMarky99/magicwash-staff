import assert from 'node:assert/strict'
import {
  readWorkRates,
  resetWorkRatesCache,
  type WorkRateReader,
} from '../../../../../server/modules/work-orders/work-rate-lookup.js'

type RateRows = Awaited<ReturnType<WorkRateReader['read']>>

const rateRows = [
  { task_code: 'WSH-OFF', department: 'Washing', active: false, minutes: 99 },
  { task_code: 'WSH-STRING-ACTIVE', department: 'Washing', active: 'true', minutes: 99 },
  { task_code: 'WSH-STRING-MINUTES', department: 'Washing', active: true, minutes: '12' },
  { task_code: 'WSH-NULL-MINUTES', department: 'Washing', active: true, minutes: null },
  { task_code: 'WSH-NAN', department: 'Washing', active: true, minutes: NaN },
  { task_code: 'WSH-INFINITY', department: 'Washing', active: true, minutes: Infinity },
  { task_code: 'WSH-NEGATIVE', department: 'Washing', active: true, minutes: -1 },
  { task_code: 'WSH-MISSING-MINUTES', department: 'Washing', active: true },
  { task_code: 'NO-DEPARTMENT', department: null, active: true, minutes: 99 },
  { task_code: 'UNKNOWN-DEPARTMENT', department: 'Laundromat', active: true, minutes: 99 },
  { department: 'Washing', active: true, minutes: 99 },
  { task_code: '   ', department: 'Washing', active: true, minutes: 99 },
  { task_code: 'bad code', department: 'Washing', active: true, minutes: 99 },
  { task_code: 'WSH-STANDARD', department: 'Washing', name_th: 'ซักมาตรฐาน', active: true, minutes: 12 },
  { task_code: ' IRN-STANDARD ', department: 'Ironing', name_th: null, active: true, minutes: 0 },
  { task_code: 'PCK-STANDARD', department: 'Packaging', active: true, minutes: 7.5 },
  { task_code: 'WSH-DUPLICATE', department: 'Washing', active: true, minutes: 5 },
  { task_code: 'WSH-DUPLICATE', department: 'Washing', active: true, minutes: 30 },
  { task_code: ' WSH-DUPLICATE ', department: 'Washing', active: true, minutes: 31 },
  { task_code: 'IRN-INACTIVE-DUPLICATE', department: 'Ironing', active: true, minutes: 8 },
  { task_code: 'IRN-INACTIVE-DUPLICATE', department: 'Ironing', active: false, minutes: 9 },
  { task_code: 'WSH-INVALID-DUPLICATE', department: 'Washing', active: true, minutes: 7 },
  { task_code: 'WSH-INVALID-DUPLICATE', department: 'Washing', active: true, minutes: 'bad' },
  { task_code: 'WSH-INVALID-FIRST', department: 'Washing', active: true, minutes: null },
  { task_code: 'WSH-INVALID-FIRST', department: 'Washing', active: true, minutes: 4 },
] as unknown as RateRows

const originalConsoleError = console.error
const loggedErrors: unknown[][] = []
console.error = (...args) => { loggedErrors.push(args) }
try {
  resetWorkRatesCache()
  let readCalls = 0
  const rates = await readWorkRates(() => ({
    async read(...args) {
      readCalls += 1
      assert.deepEqual(args, [])
      return rateRows
    },
  }))
  assert.equal(readCalls, 1)
  assert.deepEqual([...rates.keys()], ['WSH-STANDARD', 'IRN-STANDARD', 'PCK-STANDARD'])
  assert.deepEqual(rates.get('WSH-STANDARD'), { taskCode: 'WSH-STANDARD', department: 'Washing', nameTh: 'ซักมาตรฐาน', minutes: 12 })
  assert.deepEqual(rates.get('IRN-STANDARD'), { taskCode: 'IRN-STANDARD', department: 'Ironing', nameTh: null, minutes: 0 })
  assert.deepEqual(rates.get('PCK-STANDARD'), { taskCode: 'PCK-STANDARD', department: 'Packaging', nameTh: null, minutes: 7.5 })
  assert.equal(rates.has('WSH-DUPLICATE'), false)
  assert.equal(rates.has('IRN-INACTIVE-DUPLICATE'), false)
  assert.equal(rates.has('WSH-INVALID-DUPLICATE'), false)
  assert.equal(rates.has('WSH-INVALID-FIRST'), false)
  assert.equal(loggedErrors.filter(([message]) => message === 'Ignored invalid WorkRates row').length, 13)
  assert.deepEqual(loggedErrors.at(-1), ['Ignored duplicate WorkRates task codes', ['WSH-DUPLICATE', 'IRN-INACTIVE-DUPLICATE', 'WSH-INVALID-DUPLICATE', 'WSH-INVALID-FIRST']])

  assert.equal(await readWorkRates(() => { throw new Error('must use cache') }), rates)
  assert.equal(readCalls, 1)

  resetWorkRatesCache()
  loggedErrors.length = 0
  let concurrentReads = 0
  let releaseRead!: () => void
  const deferred = new Promise<void>((resolve) => { releaseRead = resolve })
  const reader = () => ({ async read() { concurrentReads += 1; await deferred; return rateRows } })
  const first = readWorkRates(reader)
  const second = readWorkRates(reader)
  await Promise.resolve()
  assert.equal(concurrentReads, 1)
  releaseRead()
  assert.equal(await first, await second)
  assert.equal(await readWorkRates(() => { throw new Error('must use cache') }), await first)

  resetWorkRatesCache()
  loggedErrors.length = 0
  const readError = new Error('WorkRates read failed')
  const failedRead = await readWorkRates(() => ({ async read() { throw readError } }))
  assert.equal(failedRead.size, 0)
  const getterError = new Error('WorkRates getter failed')
  const failedGetter = await readWorkRates(() => { throw getterError })
  assert.equal(failedGetter.size, 0)
  assert.deepEqual(loggedErrors, [
    ['Failed to read WorkRates', readError],
    ['Failed to read WorkRates', getterError],
  ])
  const recovered = await readWorkRates(() => ({ async read() { return rateRows } }))
  assert.deepEqual([...recovered.keys()], ['WSH-STANDARD', 'IRN-STANDARD', 'PCK-STANDARD'])

  resetWorkRatesCache()
  loggedErrors.length = 0
  const changing = [{ task_code: 'WSH-STANDARD', department: 'Washing', active: true, minutes: 12 }] as unknown as RateRows
  const beforeChange = await readWorkRates(() => ({ async read() { return changing } }))
  changing[0]!.minutes = 40
  assert.equal(beforeChange.get('WSH-STANDARD')?.minutes, 12)
  assert.equal((await readWorkRates(() => { throw new Error('must use cache') })).get('WSH-STANDARD')?.minutes, 12)
  resetWorkRatesCache()
  assert.equal((await readWorkRates(() => ({ async read() { return changing } }))).get('WSH-STANDARD')?.minutes, 40)
} finally {
  console.error = originalConsoleError
  resetWorkRatesCache()
}

console.log('work-rate lookup dry test passed')
