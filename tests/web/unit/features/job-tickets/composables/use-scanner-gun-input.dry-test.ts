import assert from 'node:assert/strict'
import test, { type TestContext } from 'node:test'
import { createRenderer, ref } from 'vue'
import { useScannerGunInput } from '@/shared/composables/useScannerGunInput'

class TestElement extends EventTarget {
  constructor(readonly tagName = 'DIV', readonly isContentEditable = false) { super() }
  closest(): TestElement | null {
    return ['INPUT', 'TEXTAREA', 'SELECT'].includes(this.tagName) ? this : null
  }
}

const renderer = createRenderer<object, object>({
  patchProp() {}, insert() {}, remove() {}, setText() {}, setElementText() {},
  createElement: () => ({}), createText: () => ({}), createComment: () => ({}),
  parentNode: () => null, nextSibling: () => null,
})

function setup(t: TestContext, getter = false, staffCards: 'skip' | 'only' = 'skip') {
  const windowDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'window')
  const elementDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'HTMLElement')
  const windowTarget = new EventTarget()
  Object.defineProperty(globalThis, 'window', { configurable: true, value: windowTarget })
  Object.defineProperty(globalThis, 'HTMLElement', { configurable: true, value: TestElement })
  let now = 1000
  t.mock.method(performance, 'now', () => now)
  const scans: string[] = []
  const enabled = ref(true)
  const app = renderer.createApp({
    setup() {
      useScannerGunInput(code => scans.push(code), getter ? () => enabled.value : enabled, { staffCards })
      return () => null
    },
  })
  app.mount({})
  t.after(() => {
    app.unmount()
    if (windowDescriptor) Object.defineProperty(globalThis, 'window', windowDescriptor)
    else Reflect.deleteProperty(globalThis, 'window')
    if (elementDescriptor) Object.defineProperty(globalThis, 'HTMLElement', elementDescriptor)
    else Reflect.deleteProperty(globalThis, 'HTMLElement')
  })

  function key(code: string, options: { key?: string; gap?: number; target?: TestElement; shiftKey?: boolean; ctrlKey?: boolean; altKey?: boolean; metaKey?: boolean } = {}) {
    now += options.gap ?? 10
    const event = new Event('keydown', { cancelable: true })
    for (const [name, value] of Object.entries({ code, key: '', shiftKey: false, ctrlKey: false, altKey: false, metaKey: false, ...options })) {
      Object.defineProperty(event, name, { value })
    }
    windowTarget.dispatchEvent(event)
    return event
  }
  function burst() {
    key('KeyA')
    key('Digit1')
    key('Numpad2')
  }
  return { scans, enabled, key, burst, app }
}

test('fast burst and Enter emit a code, consume Enter and clear the buffer', t => {
  const { scans, key, burst } = setup(t)
  burst()
  assert.equal(key('Enter').defaultPrevented, true)
  assert.deepEqual(scans, ['a12'])
  assert.equal(key('Enter').defaultPrevented, false)
  assert.deepEqual(scans, ['a12'])
})

test('physical codes preserve letters under the Thai keyboard layout', t => {
  const { scans, key } = setup(t)
  for (let i = 0; i < 3; i++) key('KeyO', { key: 'น' })
  key('NumpadEnter')
  assert.deepEqual(scans, ['ooo'])
})

test('maps shifted letters, digits, punctuation and printable ASCII fallback', t => {
  const { scans, key } = setup(t)
  key('KeyZ', { shiftKey: true, key: 'ฮ' })
  key('Digit0', { shiftKey: true, key: ')' })
  key('Numpad9')
  key('Minus')
  key('Minus', { shiftKey: true })
  key('Period', { shiftKey: true })
  key('Slash', { shiftKey: true })
  key('Equal', { key: '+' })
  key('ArrowLeft', { key: 'ArrowLeft' })
  key('Unknown', { key: 'น' })
  key('Enter')
  assert.deepEqual(scans, ['Z09-_./+'])
})

test('a gap over 50 ms restarts the buffer with the current character', t => {
  const { scans, key, burst } = setup(t)
  burst()
  key('KeyB', { gap: 51 })
  key('KeyC', { gap: 50 })
  key('KeyD')
  key('Enter')
  assert.deepEqual(scans, ['bcd'])
})

test('fewer than three characters emit nothing and leave Enter available', t => {
  const { scans, key } = setup(t)
  key('KeyA')
  key('KeyB')
  assert.equal(key('Enter').defaultPrevented, false)
  key('KeyC')
  key('Enter')
  assert.deepEqual(scans, [])
})

test('input, textarea, select and contenteditable targets ignore keys and clear a prior burst', t => {
  const { scans, key, burst } = setup(t)
  for (const target of [new TestElement('INPUT'), new TestElement('TEXTAREA'), new TestElement('SELECT'), new TestElement('SPAN', true)]) {
    burst()
    key('KeyX', { target })
    assert.equal(key('Enter').defaultPrevented, false)
    key('KeyA', { target })
    key('KeyB', { target })
    key('KeyC', { target })
    assert.equal(key('Enter', { target }).defaultPrevented, false)
  }
  assert.deepEqual(scans, [])
})

test('disabled ref and getter ignore scans and clear a prior burst', t => {
  const { scans, enabled, key, burst } = setup(t, true)
  burst()
  enabled.value = false
  key('KeyX')
  enabled.value = true
  key('Enter')
  enabled.value = false
  burst()
  assert.equal(key('Enter').defaultPrevented, false)
  assert.deepEqual(scans, [])
})

test('disabled ref emits nothing', t => {
  const { scans, enabled, key, burst } = setup(t)
  enabled.value = false
  burst()
  key('Enter')
  assert.deepEqual(scans, [])
})

test('modifier keys clear the buffer and do not consume Enter', t => {
  const { scans, key, burst } = setup(t)
  for (const modifier of ['ctrlKey', 'altKey', 'metaKey']) {
    burst()
    key('KeyX', { [modifier]: true })
    key('Enter')
    burst()
    assert.equal(key('Enter', { [modifier]: true }).defaultPrevented, false)
    key('Enter')
  }
  assert.deepEqual(scans, [])
})

test('unmount removes the window listener', t => {
  const { scans, key, burst, app } = setup(t)
  app.unmount()
  burst()
  assert.equal(key('Enter').defaultPrevented, false)
  assert.deepEqual(scans, [])
})

for (const mode of ['skip', 'only'] as const) {
  test(`staff cards are filtered in ${mode} mode`, t => {
    const { scans, key, burst } = setup(t, false, mode)
    burst()
    key('Enter')
    for (const code of ['KeyM', 'KeyW', 'KeyS', 'Minus', 'Digit1']) key(code)
    key('Enter')
    assert.deepEqual(scans, mode === 'only' ? ['mws-1'] : ['a12'])
  })
}
