import assert from 'node:assert/strict'
import test from 'node:test'
import { effectScope } from 'vue'
import { SCAN_NOTICE_MS, useScanNotice } from '@/features/job-tickets/composables/useScanNotice'
import type { ScanDisplay } from '@/features/job-tickets/scan-result'

const display = (message: string, tone: ScanDisplay['tone'] = 'success'): ScanDisplay => ({ title: message, message, tone })

test('a notice auto-dismisses after 5 s and the next one replaces it', t => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const scope = effectScope()
  const state = scope.run(() => useScanNotice())!
  state.show(display('one'))
  assert.equal(state.notice.value?.message, 'one')
  assert.equal(state.seq.value, 1)
  t.mock.timers.tick(SCAN_NOTICE_MS - 1)
  state.show(display('two', 'warning'))
  assert.equal(state.notice.value?.message, 'two')
  assert.equal(state.seq.value, 2)
  t.mock.timers.tick(SCAN_NOTICE_MS - 1)
  assert.equal(state.notice.value?.message, 'two')
  t.mock.timers.tick(1)
  assert.equal(state.notice.value, null)
  scope.stop()
})

test('dismiss clears at once, loading stays until replaced, scope disposal clears', t => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const scope = effectScope()
  const state = scope.run(() => useScanNotice())!
  state.show(display('one'))
  state.dismiss()
  assert.equal(state.notice.value, null)
  state.show(display('busy', 'loading'))
  t.mock.timers.tick(SCAN_NOTICE_MS * 2)
  assert.equal(state.notice.value?.tone, 'loading')
  state.show(display('three'))
  scope.stop()
  assert.equal(state.notice.value, null)
})
