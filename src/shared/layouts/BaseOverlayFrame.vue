<script lang="ts">
import { shallowReactive } from 'vue'

type OverlayStackEntry = {
  id: symbol
  frame: HTMLElement
}

const overlayStack = shallowReactive<OverlayStackEntry[]>([])
const managedInertElements = new Set<HTMLElement>()
const originalInertValues = new WeakMap<HTMLElement, boolean>()
let inertObserver: MutationObserver | null = null

function setManagedInert(element: HTMLElement, inert: boolean) {
  if (inert) {
    if (!managedInertElements.has(element)) originalInertValues.set(element, element.inert)
    managedInertElements.add(element)
    element.inert = true
    return
  }

  if (!managedInertElements.has(element)) return
  element.inert = originalInertValues.get(element) ?? false
  managedInertElements.delete(element)
}

function refreshInertElements() {
  const overlayRoot = document.getElementById('overlay-root')
  const appColumn = overlayRoot?.parentElement
  const topFrame = overlayStack.at(-1)?.frame
  const nextInertElements = new Set<HTMLElement>()

  if (overlayRoot && appColumn && topFrame) {
    for (const child of appColumn.children) {
      if (child instanceof HTMLElement && child !== overlayRoot) nextInertElements.add(child)
    }

    for (const entry of overlayStack) {
      if (entry.frame !== topFrame) nextInertElements.add(entry.frame)
    }
  }

  for (const element of managedInertElements) {
    if (!nextInertElements.has(element)) setManagedInert(element, false)
  }

  for (const element of nextInertElements) setManagedInert(element, true)
}

function registerOverlay(id: symbol, frame: HTMLElement) {
  const existingIndex = overlayStack.findIndex((entry) => entry.id === id)
  if (existingIndex >= 0) overlayStack.splice(existingIndex, 1)
  overlayStack.push({ id, frame })

  if (!inertObserver) {
    const overlayRoot = document.getElementById('overlay-root')
    const appColumn = overlayRoot?.parentElement
    if (overlayRoot && appColumn) {
      inertObserver = new MutationObserver(refreshInertElements)
      inertObserver.observe(appColumn, { childList: true })
      inertObserver.observe(overlayRoot, { childList: true })
    }
  }

  refreshInertElements()
}

function unregisterOverlay(id: symbol) {
  const index = overlayStack.findIndex((entry) => entry.id === id)
  if (index >= 0) overlayStack.splice(index, 1)
  refreshInertElements()

  if (overlayStack.length === 0) {
    inertObserver?.disconnect()
    inertObserver = null
  }
}
</script>

<script setup lang="ts">
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onDeactivated,
  onMounted,
  ref,
  watch,
} from 'vue'
import { acquirePageScrollLock, releasePageScrollLock } from '@/shared/layouts/use-page-scroll-lock'
import { useFocusTrap } from '@/shared/layouts/use-focus-trap'

type OverlayPlacement = 'bottom' | 'top' | 'left' | 'right' | 'center'
type OverlayBackdrop = 'opaque' | 'translucent' | 'none'

const props = withDefaults(
  defineProps<{
    open: boolean
    placement: OverlayPlacement
    size: string
    backdrop: OverlayBackdrop
    draggable: boolean
    closeButton: boolean
    panelClass?: string
    ariaLabel: string
    closeOnBackdrop?: boolean
  }>(),
  {
    panelClass: '',
    closeOnBackdrop: true,
  },
)

const emit = defineEmits<{
  close: []
}>()

const CLOSE_THRESHOLD = 80
const overlayId = Symbol('overlay-frame')
const frameRef = ref<HTMLElement | null>(null)
const panelRef = ref<HTMLElement | null>(null)
const closeButtonRef = ref<HTMLButtonElement | null>(null)
const rendered = ref(false)
const visible = ref(false)
const dragging = ref(false)
const dragOffset = ref(0)
const dragPointerId = ref<number | null>(null)
const viewportHeight = ref<number | null>(null)
const viewportOffsetTop = ref(0)
const isTopmost = computed(() => overlayStack.at(-1)?.id === overlayId)
const focusTrapEnabled = computed(() => visible.value && isTopmost.value)
const transitionName = computed(() => `base-overlay-frame-${props.placement}`)
const frameClass = computed(() => ({
  'items-end justify-center': props.placement === 'bottom',
  'items-start justify-center': props.placement === 'top',
  'items-stretch justify-start': props.placement === 'left',
  'items-stretch justify-end': props.placement === 'right',
  'items-center justify-center p-4': props.placement === 'center',
}))
const panelPlacementClass = computed(() => ({
  'w-full flex-col rounded-t-2xl': props.placement === 'bottom' && props.size !== 'full',
  'w-full flex-col': (props.placement === 'bottom' && props.size === 'full') || props.placement === 'top',
  'h-full flex-row': props.placement === 'left' || props.placement === 'right',
  'w-full flex-col rounded-2xl': props.placement === 'center',
  'base-overlay-frame-panel--dragging': dragging.value,
}))
const backdropClass = computed(() => ({
  'bg-black/70': props.backdrop === 'opaque',
  'bg-black/40': props.backdrop === 'translucent',
  'bg-transparent': props.backdrop === 'none',
}))
const frameStyle = computed(() => {
  if (viewportHeight.value === null) return undefined
  return {
    top: `${viewportOffsetTop.value}px`,
    bottom: 'auto',
    height: `${viewportHeight.value}px`,
  }
})
const panelStyle = computed(() => {
  const size = props.size === 'full' ? '100%' : props.size
  const style: Record<string, string> = { maxHeight: '100%', maxWidth: '100%' }

  if (props.placement === 'bottom' || props.placement === 'top') style.height = size
  if (props.placement === 'left' || props.placement === 'right') style.width = size
  if (props.placement === 'center') style.maxWidth = size

  if (dragOffset.value > 0) {
    const distance = `${dragOffset.value}px`
    if (props.placement === 'bottom') style.transform = `translate3d(0, ${distance}, 0)`
    if (props.placement === 'top') style.transform = `translate3d(0, -${distance}, 0)`
    if (props.placement === 'left') style.transform = `translate3d(-${distance}, 0, 0)`
    if (props.placement === 'right') style.transform = `translate3d(${distance}, 0, 0)`
  }

  return style
})
const dragHandleClass = computed(() => ({
  'h-11 w-full': props.placement === 'bottom' || props.placement === 'top',
  'h-full w-11': props.placement === 'left' || props.placement === 'right',
}))
const dragHandleBarClass = computed(() => ({
  'h-1 w-9': props.placement === 'bottom' || props.placement === 'top',
  'h-9 w-1': props.placement === 'left' || props.placement === 'right',
}))

let previousActiveElement: HTMLElement | null = null
let ownsPageScrollLock = false
let dragStartCoordinate = 0
let dragCaptureElement: HTMLElement | null = null

useFocusTrap(panelRef, focusTrapEnabled)

function updateVisualViewport() {
  const visualViewport = window.visualViewport
  viewportHeight.value = visualViewport?.height ?? null
  viewportOffsetTop.value = visualViewport?.offsetTop ?? 0
}

function lockPageScroll() {
  if (ownsPageScrollLock) return
  acquirePageScrollLock()
  ownsPageScrollLock = true
}

function unlockPageScroll() {
  if (!ownsPageScrollLock) return
  ownsPageScrollLock = false
  releasePageScrollLock()
}

function restoreFocus() {
  if (previousActiveElement?.isConnected) previousActiveElement.focus({ preventScroll: true })
  previousActiveElement = null
}

function focusPanel() {
  const panel = panelRef.value
  if (!panel) return

  const autofocusElement = panel.querySelector<HTMLElement>('[autofocus]')
  const initialElement = autofocusElement ?? closeButtonRef.value ?? panel
  initialElement.focus({ preventScroll: true })
}

function resetDrag() {
  const pointerId = dragPointerId.value
  if (dragCaptureElement && pointerId !== null && dragCaptureElement.hasPointerCapture(pointerId)) {
    dragCaptureElement.releasePointerCapture(pointerId)
  }

  dragCaptureElement = null
  dragPointerId.value = null
  dragging.value = false
  dragOffset.value = 0
}

function openFrame() {
  if (!rendered.value) {
    const activeElement = document.activeElement
    previousActiveElement = activeElement instanceof HTMLElement ? activeElement : null
    lockPageScroll()
  }

  rendered.value = true
  visible.value = true
  void nextTick(() => {
    if (!frameRef.value || !visible.value) return
    registerOverlay(overlayId, frameRef.value)
    focusPanel()
  })
}

function closeFrame() {
  resetDrag()
  visible.value = false
}

function finishClose() {
  if (props.open || visible.value) return
  rendered.value = false
  unregisterOverlay(overlayId)
  unlockPageScroll()
  restoreFocus()
}

function requestClose() {
  if (!visible.value || !isTopmost.value) return
  emit('close')
}

function handleBackdropClick() {
  if (props.closeOnBackdrop) requestClose()
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key !== 'Escape' || !isTopmost.value) return
  event.preventDefault()
  event.stopPropagation()
  requestClose()
}

function dragCoordinate(event: PointerEvent) {
  return props.placement === 'left' || props.placement === 'right' ? event.clientX : event.clientY
}

function dragDistance(event: PointerEvent) {
  const delta = dragCoordinate(event) - dragStartCoordinate
  return props.placement === 'top' || props.placement === 'left' ? -delta : delta
}

function handleDragStart(event: PointerEvent) {
  if (!props.draggable || props.placement === 'center' || !isTopmost.value) return
  dragStartCoordinate = dragCoordinate(event)
  dragPointerId.value = event.pointerId
  dragging.value = true
  dragOffset.value = 0

  if (event.currentTarget instanceof HTMLElement) {
    dragCaptureElement = event.currentTarget
    event.currentTarget.setPointerCapture(event.pointerId)
  }
}

function handleDragMove(event: PointerEvent) {
  if (!dragging.value || dragPointerId.value !== event.pointerId) return
  dragOffset.value = Math.max(0, dragDistance(event))
}

function handleDragEnd(event: PointerEvent) {
  if (!dragging.value || dragPointerId.value !== event.pointerId) return
  const shouldClose = dragOffset.value >= CLOSE_THRESHOLD
  resetDrag()
  if (shouldClose) requestClose()
}

function handleDeactivated() {
  if (!rendered.value) return
  rendered.value = false
  visible.value = false
  cleanup()
  emit('close')
}

function cleanup() {
  resetDrag()
  unregisterOverlay(overlayId)
  unlockPageScroll()
  restoreFocus()
}

watch(
  () => props.open,
  (open) => {
    if (open) openFrame()
    else closeFrame()
  },
  { immediate: true },
)

onMounted(() => {
  updateVisualViewport()
  document.addEventListener('keydown', handleKeydown)
  window.visualViewport?.addEventListener('resize', updateVisualViewport)
  window.visualViewport?.addEventListener('scroll', updateVisualViewport)
})

onBeforeUnmount(() => {
  document.removeEventListener('keydown', handleKeydown)
  window.visualViewport?.removeEventListener('resize', updateVisualViewport)
  window.visualViewport?.removeEventListener('scroll', updateVisualViewport)
  cleanup()
})

onDeactivated(handleDeactivated)
</script>

<template>
  <Teleport to="#overlay-root">
    <div
      v-if="rendered"
      ref="frameRef"
      class="pointer-events-none absolute inset-x-0 bottom-0 top-0 flex overflow-hidden text-on-surface"
      :class="frameClass"
      :style="frameStyle"
      data-overlay-frame
    >
      <Transition name="base-overlay-frame-backdrop" appear>
        <div
          v-if="visible"
          class="pointer-events-auto absolute inset-0"
          :class="backdropClass"
          data-overlay-backdrop
          @click="handleBackdropClick"
        />
      </Transition>

      <Transition :name="transitionName" appear @after-leave="finishClose">
        <section
          v-if="visible"
          ref="panelRef"
          :aria-label="ariaLabel"
          aria-modal="true"
          role="dialog"
          tabindex="-1"
          class="base-overlay-frame-panel pointer-events-auto relative z-10 flex min-h-0 min-w-0 flex-col overflow-hidden bg-surface shadow-2xl"
          :class="[panelPlacementClass, panelClass]"
          :style="panelStyle"
          data-overlay-panel
        >
          <div
            v-if="draggable && placement !== 'center'"
            class="pointer-events-none flex flex-none items-center justify-center"
            :class="dragHandleClass"
            aria-hidden="true"
          >
            <div
              class="pointer-events-auto flex h-11 w-11 touch-none select-none items-center justify-center"
              data-overlay-drag-handle
              @pointerdown="handleDragStart"
              @pointermove="handleDragMove"
              @pointerup="handleDragEnd"
              @pointercancel="resetDrag"
            >
              <span
                class="rounded-full bg-outline-variant"
                :class="dragHandleBarClass"
                aria-hidden="true"
              />
            </div>
          </div>

          <button
            v-if="closeButton"
            ref="closeButtonRef"
            type="button"
            class="absolute right-4 top-4 z-20 flex h-10 w-10 items-center justify-center rounded-full text-on-surface transition-colors hover:bg-surface-container focus:outline-none focus:ring-2 focus:ring-primary/40"
            aria-label="Close"
            @click="requestClose"
          >
            <slot name="close-button">
              <span class="material-symbols-outlined text-[20px]" aria-hidden="true">close</span>
            </slot>
          </button>

          <div class="flex min-h-0 min-w-0 flex-1 flex-col">
            <slot />
          </div>
        </section>
      </Transition>
    </div>
  </Teleport>
</template>

<style scoped>
.base-overlay-frame-panel {
  will-change: transform, opacity;
  transition: transform 240ms cubic-bezier(0.25, 0.46, 0.45, 0.94);
}

.base-overlay-frame-panel--dragging {
  transition: none;
}

.base-overlay-frame-backdrop-enter-active,
.base-overlay-frame-backdrop-leave-active {
  transition: opacity 180ms ease;
}

.base-overlay-frame-backdrop-enter-from,
.base-overlay-frame-backdrop-leave-to {
  opacity: 0;
}

.base-overlay-frame-bottom-enter-active,
.base-overlay-frame-bottom-leave-active,
.base-overlay-frame-top-enter-active,
.base-overlay-frame-top-leave-active,
.base-overlay-frame-left-enter-active,
.base-overlay-frame-left-leave-active,
.base-overlay-frame-right-enter-active,
.base-overlay-frame-right-leave-active {
  transition: transform 380ms cubic-bezier(0.25, 0.46, 0.45, 0.94);
}

.base-overlay-frame-bottom-enter-from,
.base-overlay-frame-bottom-leave-to {
  transform: translate3d(0, 100%, 0);
}

.base-overlay-frame-top-enter-from,
.base-overlay-frame-top-leave-to {
  transform: translate3d(0, -100%, 0);
}

.base-overlay-frame-left-enter-from,
.base-overlay-frame-left-leave-to {
  transform: translate3d(-100%, 0, 0);
}

.base-overlay-frame-right-enter-from,
.base-overlay-frame-right-leave-to {
  transform: translate3d(100%, 0, 0);
}

.base-overlay-frame-center-enter-active,
.base-overlay-frame-center-leave-active {
  transition: opacity 180ms ease, transform 180ms ease;
}

.base-overlay-frame-center-enter-from,
.base-overlay-frame-center-leave-to {
  opacity: 0;
  transform: scale(0.96);
}
</style>
