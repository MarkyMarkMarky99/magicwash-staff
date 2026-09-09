import { onScopeDispose, readonly, ref } from 'vue'

const OPEN_THRESHOLD = 150
const CLOSE_THRESHOLD = 130

const open = ref(false)
const baseline = ref<number | null>(null)
const readonlyOpen = readonly(open)

let listeners = 0
let focusoutFrame: number | null = null

export const softKeyboardBaseline = readonly(baseline)

function editableElementHasFocus() {
  const activeElement = document.activeElement
  if (!(activeElement instanceof HTMLElement)) return false
  if (activeElement.matches('input, textarea')) {
    return !activeElement.matches('[readonly], [disabled]')
  }
  return activeElement.matches('[contenteditable]')
    && activeElement.isContentEditable
    && !activeElement.matches('[readonly], [disabled]')
}

function measure(updateBaseline: boolean) {
  const visualViewport = window.visualViewport
  if (!visualViewport) {
    open.value = false
    return
  }

  if (!editableElementHasFocus()) {
    if (updateBaseline) baseline.value = visualViewport.height
    open.value = false
    return
  }

  if (baseline.value === null) {
    open.value = false
    return
  }

  const heightGap = baseline.value - visualViewport.height
  open.value = open.value
    ? heightGap > CLOSE_THRESHOLD
    : heightGap > OPEN_THRESHOLD
}

function handleViewportChange() {
  measure(true)
}

function handleFocusIn() {
  measure(false)
}

function handleFocusOut() {
  if (focusoutFrame !== null) window.cancelAnimationFrame(focusoutFrame)
  focusoutFrame = window.requestAnimationFrame(() => {
    focusoutFrame = null
    measure(false)
  })
}

function addListeners() {
  measure(true)
  document.addEventListener('focusin', handleFocusIn)
  document.addEventListener('focusout', handleFocusOut)
  window.visualViewport?.addEventListener('resize', handleViewportChange)
  window.visualViewport?.addEventListener('scroll', handleViewportChange)
}

function removeListeners() {
  document.removeEventListener('focusin', handleFocusIn)
  document.removeEventListener('focusout', handleFocusOut)
  window.visualViewport?.removeEventListener('resize', handleViewportChange)
  window.visualViewport?.removeEventListener('scroll', handleViewportChange)
  if (focusoutFrame !== null) window.cancelAnimationFrame(focusoutFrame)
  focusoutFrame = null
  open.value = false
  baseline.value = null
}

export function useSoftKeyboard() {
  if (typeof window !== 'undefined') {
    if (listeners === 0) addListeners()
    listeners += 1

    onScopeDispose(() => {
      listeners -= 1
      if (listeners === 0) removeListeners()
    })
  }

  return readonlyOpen
}
