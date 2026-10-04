import { onBeforeUnmount, onMounted, ref, type Ref } from 'vue'
import { PULL_HOLD_OFFSET, pullIntent, pullOffset, shouldRefresh } from '@/shared/utils/pull-to-refresh'

export type PullPhase = 'idle' | 'pulling' | 'refreshing' | 'closing'

export function usePullToRefresh(target: Ref<HTMLElement | null>, onRefresh: () => Promise<void>) {
  const offset = ref(0)
  const phase = ref<PullPhase>('idle')

  let startX = 0
  let startY = 0
  let tracking = false

  function begin(x: number, y: number): void {
    const element = target.value
    if (element === null || phase.value === 'refreshing' || element.scrollTop > 0) return
    startX = x
    startY = y
    tracking = true
  }

  function move(x: number, y: number): boolean {
    const element = target.value
    if (!tracking || element === null) return false
    if (phase.value !== 'pulling') {
      if (element.scrollTop > 0) {
        tracking = false
        return false
      }
      const intent = pullIntent(x - startX, y - startY)
      if (intent === 'undecided') return false
      if (intent === 'ignore') {
        tracking = false
        return false
      }
      phase.value = 'pulling'
    }
    offset.value = pullOffset(y - startY)
    return true
  }

  async function end(): Promise<void> {
    const wasPulling = tracking && phase.value === 'pulling'
    tracking = false
    if (!wasPulling) return
    if (!shouldRefresh(offset.value)) {
      offset.value = 0
      phase.value = 'idle'
      return
    }
    phase.value = 'refreshing'
    offset.value = PULL_HOLD_OFFSET
    try {
      await onRefresh()
    } finally {
      offset.value = 0
      phase.value = 'closing'
    }
  }

  function cancel(): void {
    const wasPulling = tracking && phase.value === 'pulling'
    tracking = false
    if (!wasPulling) return
    offset.value = 0
    phase.value = 'idle'
  }

  function onTouchStart(event: TouchEvent): void {
    const touch = event.touches[0]
    if (event.touches.length > 1) cancel()
    else if (touch !== undefined) begin(touch.clientX, touch.clientY)
  }

  function onTouchMove(event: TouchEvent): void {
    const touch = event.touches[0]
    if (event.touches.length !== 1 || touch === undefined) return
    if (move(touch.clientX, touch.clientY) && event.cancelable) event.preventDefault()
  }

  function onPointerDown(event: PointerEvent): void {
    if (event.pointerType === 'mouse' && event.button === 0) begin(event.clientX, event.clientY)
  }

  function onPointerMove(event: PointerEvent): void {
    if (event.pointerType !== 'mouse') return
    const alreadyPulling = phase.value === 'pulling'
    if (!move(event.clientX, event.clientY)) return
    if (!alreadyPulling) target.value?.setPointerCapture(event.pointerId)
    event.preventDefault()
  }

  function onPointerEnd(event: PointerEvent): void {
    if (event.pointerType !== 'mouse') return
    if (event.type === 'pointercancel') cancel()
    else void end()
  }

  const onTouchEnd = () => void end()

  onMounted(() => {
    const element = target.value
    if (element === null) return
    element.addEventListener('touchstart', onTouchStart, { passive: true })
    element.addEventListener('touchmove', onTouchMove, { passive: false })
    element.addEventListener('touchend', onTouchEnd)
    element.addEventListener('touchcancel', cancel)
    element.addEventListener('pointerdown', onPointerDown)
    element.addEventListener('pointermove', onPointerMove)
    element.addEventListener('pointerup', onPointerEnd)
    element.addEventListener('pointercancel', onPointerEnd)
  })

  onBeforeUnmount(() => {
    const element = target.value
    if (element === null) return
    element.removeEventListener('touchstart', onTouchStart)
    element.removeEventListener('touchmove', onTouchMove)
    element.removeEventListener('touchend', onTouchEnd)
    element.removeEventListener('touchcancel', cancel)
    element.removeEventListener('pointerdown', onPointerDown)
    element.removeEventListener('pointermove', onPointerMove)
    element.removeEventListener('pointerup', onPointerEnd)
    element.removeEventListener('pointercancel', onPointerEnd)
  })

  return { offset, phase }
}
