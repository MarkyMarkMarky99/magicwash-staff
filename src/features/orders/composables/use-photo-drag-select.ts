import { onBeforeUnmount, ref, type Ref } from 'vue'

const LONG_PRESS_MS = 350
const MOVE_TOLERANCE_PX = 8
const EDGE_PX = 64
const MAX_SCROLL_STEP_PX = 14

interface DragSelectOptions {
  ids: Ref<string[]>
  scroller: Ref<HTMLElement | null>
  onStart: () => void
}

export function usePhotoDragSelect({ ids, scroller, onStart }: DragSelectOptions) {
  const selected = ref<Set<string>>(new Set())
  const dragging = ref(false)

  let pressTimer: ReturnType<typeof setTimeout> | null = null
  let pointerId: number | null = null
  let startX = 0
  let startY = 0
  let lastX = 0
  let lastY = 0
  let anchorIndex = -1
  let adding = true
  let baseSelection = new Set<string>()
  let frame = 0
  let suppressClick = false

  function clearPressTimer() {
    if (pressTimer !== null) clearTimeout(pressTimer)
    pressTimer = null
  }

  function indexAt(x: number, y: number): number {
    const tile = document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-photo-index]')
    return tile ? Number(tile.dataset.photoIndex) : -1
  }

  function applyRange(currentIndex: number) {
    if (currentIndex < 0) return
    const next = new Set(baseSelection)
    const from = Math.min(anchorIndex, currentIndex)
    const to = Math.max(anchorIndex, currentIndex)
    for (let index = from; index <= to; index += 1) {
      const id = ids.value[index]
      if (id === undefined) continue
      if (adding) next.add(id)
      else next.delete(id)
    }
    selected.value = next
  }

  function autoScroll() {
    const element = scroller.value
    if (!dragging.value || !element) return
    const bounds = element.getBoundingClientRect()
    let step = 0
    if (lastY < bounds.top + EDGE_PX) step = -MAX_SCROLL_STEP_PX * (1 - Math.max(0, lastY - bounds.top) / EDGE_PX)
    else if (lastY > bounds.bottom - EDGE_PX) step = MAX_SCROLL_STEP_PX * (1 - Math.max(0, bounds.bottom - lastY) / EDGE_PX)
    if (step !== 0) {
      element.scrollTop += step
      applyRange(indexAt(lastX, lastY))
    }
    frame = requestAnimationFrame(autoScroll)
  }

  function startDrag() {
    pressTimer = null
    if (anchorIndex < 0) return
    onStart()
    dragging.value = true
    suppressClick = true
    const anchorId = ids.value[anchorIndex]
    adding = anchorId === undefined || !selected.value.has(anchorId)
    baseSelection = new Set(selected.value)
    applyRange(anchorIndex)
    navigator.vibrate?.(10)
    frame = requestAnimationFrame(autoScroll)
  }

  function endDrag() {
    clearPressTimer()
    cancelAnimationFrame(frame)
    dragging.value = false
    pointerId = null
  }

  function onPointerDown(event: PointerEvent) {
    if (event.button !== 0 || pointerId !== null) return
    const index = indexAt(event.clientX, event.clientY)
    if (index < 0) return
    pointerId = event.pointerId
    anchorIndex = index
    startX = lastX = event.clientX
    startY = lastY = event.clientY
    suppressClick = false
    pressTimer = setTimeout(startDrag, LONG_PRESS_MS)
  }

  function onPointerMove(event: PointerEvent) {
    if (event.pointerId !== pointerId) return
    lastX = event.clientX
    lastY = event.clientY
    if (pressTimer !== null) {
      if (Math.hypot(lastX - startX, lastY - startY) > MOVE_TOLERANCE_PX) {
        clearPressTimer()
        pointerId = null
      }
      return
    }
    if (dragging.value) applyRange(indexAt(lastX, lastY))
  }

  function onPointerEnd(event: PointerEvent) {
    if (event.pointerId !== pointerId) return
    endDrag()
  }

  function onTouchMove(event: TouchEvent) {
    if (dragging.value && event.cancelable) event.preventDefault()
  }

  function consumeClick(): boolean {
    const suppressed = suppressClick
    suppressClick = false
    return suppressed
  }

  function toggle(id: string) {
    const next = new Set(selected.value)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    selected.value = next
  }

  function clear() {
    selected.value = new Set()
  }

  onBeforeUnmount(endDrag)

  return {
    selected,
    dragging,
    toggle,
    clear,
    consumeClick,
    handlers: { onPointerDown, onPointerMove, onPointerEnd, onTouchMove },
  }
}
