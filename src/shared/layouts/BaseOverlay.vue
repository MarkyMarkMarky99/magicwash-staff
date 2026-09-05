<script lang="ts">
let pageScrollLockCount = 0
let previousBodyOverflow: string | undefined
let previousDocumentOverflow: string | undefined

function acquirePageScrollLock() {
  if (pageScrollLockCount === 0) {
    previousBodyOverflow = document.body.style.overflow
    previousDocumentOverflow = document.documentElement.style.overflow
    document.body.style.overflow = 'hidden'
    document.documentElement.style.overflow = 'hidden'
  }

  pageScrollLockCount += 1
}

function releasePageScrollLock() {
  if (pageScrollLockCount === 0) return

  pageScrollLockCount -= 1
  if (pageScrollLockCount !== 0) return

  document.body.style.overflow = previousBodyOverflow ?? ''
  document.documentElement.style.overflow = previousDocumentOverflow ?? ''
  previousBodyOverflow = undefined
  previousDocumentOverflow = undefined
}
</script>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onDeactivated, onMounted, ref, watch } from 'vue'

type OverlayVariant = 'full' | 'sheet'

const props = withDefaults(
  defineProps<{
    open: boolean
    variant?: OverlayVariant
    closeOnBackdrop?: boolean
    ariaLabel?: string
  }>(),
  {
    variant: 'full',
    closeOnBackdrop: true,
  },
)

const emit = defineEmits<{
  close: []
}>()

const CLOSE_THRESHOLD = 80

const dialogRef = ref<HTMLDialogElement | null>(null)
const closeButtonRef = ref<HTMLButtonElement | null>(null)
const panelVisible = ref(false)
const pendingClose = ref(false)
const dragOffset = ref(0)
const dragging = ref(false)
const dragPointerId = ref<number | null>(null)
const transitionName = computed(() => `base-overlay-${props.variant}`)
const panelStyle = computed(() => {
  if (props.variant !== 'sheet' || (!dragging.value && dragOffset.value === 0)) return undefined

  return { transform: `translateY(${dragOffset.value}px)` }
})

let dragStartY = 0
let pointerSequenceId: number | null = null
let pointerSequenceStartedInContent = false
let pointerSequenceMoved = false
let pointerSequenceStartX = 0
let pointerSequenceStartY = 0
let suppressBackdropClick = false
let dragCaptureElement: HTMLElement | null = null
let ownsPageScrollLock = false
let previousActiveElement: HTMLElement | null = null
let closeHandled = true

function lockPageScroll() {
  if (ownsPageScrollLock) return

  acquirePageScrollLock()
  ownsPageScrollLock = true
}

function restorePageScroll() {
  if (!ownsPageScrollLock) return

  ownsPageScrollLock = false
  releasePageScrollLock()
}

function resetFocus() {
  if (previousActiveElement?.isConnected) previousActiveElement.focus()
  previousActiveElement = null
}

function focusCloseButton() {
  if (dialogRef.value?.open) closeButtonRef.value?.focus()
}

function resetDragState() {
  const pointerId = dragPointerId.value
  if (dragCaptureElement && pointerId !== null && dragCaptureElement.hasPointerCapture(pointerId)) {
    dragCaptureElement.releasePointerCapture(pointerId)
  }

  dragCaptureElement = null
  dragging.value = false
  dragPointerId.value = null
  dragOffset.value = 0
}

function showDialog() {
  const dialog = dialogRef.value
  if (!dialog) return

  if (!dialog.open) {
    const activeElement = document.activeElement
    previousActiveElement = activeElement instanceof HTMLElement ? activeElement : null
    dialog.showModal()
    closeHandled = false
    lockPageScroll()
  }

  pendingClose.value = false
  panelVisible.value = true
  void nextTick(focusCloseButton)
}

function requestClose() {
  if (!dialogRef.value?.open) return

  resetDragState()
  pendingClose.value = true
  panelVisible.value = false
}

function finishCloseTransition() {
  if (!pendingClose.value) return

  pendingClose.value = false
  const dialog = dialogRef.value
  if (dialog?.open) dialog.close()
}

function synchronizeDialog(isOpen: boolean) {
  if (isOpen) {
    showDialog()
    return
  }

  resetDragState()

  if (dialogRef.value?.open) {
    pendingClose.value = true
    panelVisible.value = false
    return
  }

  panelVisible.value = false
  restorePageScroll()
}

function handleNativeClose() {
  if (closeHandled) return

  closeHandled = true
  panelVisible.value = false
  pendingClose.value = false
  resetDragState()
  restorePageScroll()
  resetFocus()
  emit('close')
}

function handleDialogCancel(event: Event) {
  event.preventDefault()
  requestClose()
}

function handleDialogPointerDown(event: PointerEvent) {
  pointerSequenceId = event.pointerId
  pointerSequenceStartedInContent = event.target !== event.currentTarget
  pointerSequenceMoved = false
  pointerSequenceStartX = event.clientX
  pointerSequenceStartY = event.clientY
  suppressBackdropClick = false
}

function handleDialogPointerMove(event: PointerEvent) {
  if (pointerSequenceId !== event.pointerId) return

  if (event.clientX !== pointerSequenceStartX || event.clientY !== pointerSequenceStartY) {
    pointerSequenceMoved = true
  }
}

function handleDialogPointerEnd(event: PointerEvent) {
  if (pointerSequenceId !== event.pointerId) return

  const moved =
    pointerSequenceMoved || event.clientX !== pointerSequenceStartX || event.clientY !== pointerSequenceStartY
  suppressBackdropClick = pointerSequenceStartedInContent && moved
  pointerSequenceId = null
  pointerSequenceStartedInContent = false
  pointerSequenceMoved = false
}

function handleDialogClick(event: MouseEvent) {
  if (event.target !== event.currentTarget) return

  if (suppressBackdropClick) {
    suppressBackdropClick = false
    return
  }

  if (props.closeOnBackdrop) requestClose()
}

function handlePointerDown(event: PointerEvent) {
  if (props.variant !== 'sheet' || !dialogRef.value?.open) return

  dragStartY = event.clientY
  dragPointerId.value = event.pointerId
  dragOffset.value = 0
  dragging.value = true

  if (event.currentTarget instanceof HTMLElement) {
    dragCaptureElement = event.currentTarget
    event.currentTarget.setPointerCapture(event.pointerId)
  }
}

function handlePointerMove(event: PointerEvent) {
  if (!dragging.value || dragPointerId.value !== event.pointerId) return

  dragOffset.value = Math.max(0, event.clientY - dragStartY)
}

function handlePointerEnd(event: PointerEvent) {
  if (!dragging.value || dragPointerId.value !== event.pointerId) return

  const shouldClose = dragOffset.value >= CLOSE_THRESHOLD
  resetDragState()

  if (shouldClose) requestClose()
}

function handlePointerCancel(event: PointerEvent) {
  if (!dragging.value || dragPointerId.value !== event.pointerId) return

  resetDragState()
}

function handleUnmount() {
  if (dialogRef.value?.open) dialogRef.value.close()
  handleNativeClose()
}

watch(() => props.open, synchronizeDialog)

onMounted(() => {
  synchronizeDialog(props.open)
})

onBeforeUnmount(handleUnmount)
onDeactivated(handleUnmount)
</script>

<template>
  <Teleport to="body">
    <dialog
      ref="dialogRef"
      class="fixed inset-0 m-0 flex h-full max-h-none w-full max-w-none items-end justify-center border-0 bg-transparent p-0 text-on-surface backdrop:bg-black/40"
      :aria-label="ariaLabel ?? 'Dialog'"
      @pointerdown="handleDialogPointerDown"
      @pointermove="handleDialogPointerMove"
      @pointerup="handleDialogPointerEnd"
      @pointercancel="handleDialogPointerEnd"
      @click="handleDialogClick"
      @cancel="handleDialogCancel"
      @close="handleNativeClose"
    >
      <Transition :name="transitionName" appear @after-leave="finishCloseTransition">
        <div
          v-if="panelVisible"
          class="base-overlay-panel relative z-10"
          :class="[
            variant === 'sheet' ? 'base-overlay-sheet-panel flex max-h-[84vh] w-full sm:max-w-[390px] flex-col overflow-hidden rounded-t-2xl bg-surface shadow-2xl' : 'base-overlay-full-panel flex h-full w-full sm:max-w-[390px] flex-col overflow-hidden bg-surface',
            { 'is-dragging': dragging },
          ]"
          :style="panelStyle"
          @click.stop
        >
          <div
            v-if="variant === 'sheet'"
            class="flex flex-none touch-none select-none items-center justify-center pb-1 pt-3"
            aria-hidden="true"
            @pointerdown="handlePointerDown"
            @pointermove="handlePointerMove"
            @pointerup="handlePointerEnd"
            @pointercancel="handlePointerCancel"
          >
            <div class="h-1 w-9 rounded-full bg-outline-variant" />
          </div>

          <button
            ref="closeButtonRef"
            type="button"
            class="absolute right-4 top-4 z-20 flex h-10 w-10 items-center justify-center rounded-full text-on-surface transition-colors hover:bg-surface-container focus:outline-none focus:ring-2 focus:ring-primary/40"
            aria-label="Close"
            @click="requestClose"
          >
            <span class="material-symbols-outlined text-[20px]" aria-hidden="true">close</span>
          </button>

          <div class="min-h-0 flex-1 overflow-y-auto">
            <slot />
          </div>
        </div>
      </Transition>
    </dialog>
  </Teleport>
</template>

<style scoped>
dialog:not([open]) {
  display: none;
}

.base-overlay-panel {
  will-change: transform, opacity;
}

.base-overlay-full-enter-active,
.base-overlay-full-leave-active {
  transition: opacity 180ms ease, transform 180ms ease;
}

.base-overlay-full-enter-from,
.base-overlay-full-leave-to {
  opacity: 0;
  transform: scale(0.98);
}

/* A bottom sheet slides; it does not fade. It used to do both, and the two
   cancelled out: cubic-bezier(0.2, 0.8, 0.2, 1) covers ~92% of the travel in
   the first 90ms, which is exactly the window where the panel was still
   transparent — so the slide happened while it was invisible and the sheet
   read as popping into place. Opacity is gone from the panel (the backdrop
   supplies the dimming) and the curve is a gentle decelerate over a longer
   run, so the travel is actually visible.

   Compounded with .base-overlay-sheet-panel on purpose: that class carries its
   own `transition: transform` for the drag snap-back, and `transition` is a
   shorthand, so at equal specificity the later rule would replace this one
   wholesale. These selectors must stay more specific than it. */
.base-overlay-sheet-panel.base-overlay-sheet-enter-active,
.base-overlay-sheet-panel.base-overlay-sheet-leave-active {
  transition: transform 320ms cubic-bezier(0.32, 0.72, 0, 1);
}

.base-overlay-sheet-enter-from,
.base-overlay-sheet-leave-to {
  transform: translateY(100%);
}

.base-overlay-sheet-panel {
  transition: transform 200ms cubic-bezier(0.32, 0.72, 0, 1);
}

.base-overlay-sheet-panel.is-dragging {
  transition: none;
}
</style>
