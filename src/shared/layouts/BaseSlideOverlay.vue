<script setup lang="ts">
import { nextTick, onBeforeUnmount, onDeactivated, onMounted, ref, watch } from 'vue'
import { acquirePageScrollLock, releasePageScrollLock } from '@/shared/layouts/use-page-scroll-lock'

const CLOSE_THRESHOLD = 80

const props = withDefaults(
  defineProps<{
    open: boolean
    closeOnBackdrop?: boolean
    ariaLabel?: string
  }>(),
  {
    closeOnBackdrop: true,
  },
)

const emit = defineEmits<{
  close: []
}>()

const dialogRef = ref<HTMLDialogElement | null>(null)
const closeButtonRef = ref<HTMLButtonElement | null>(null)
const panelVisible = ref(false)
const pendingClose = ref(false)
const dragOffset = ref(0)
const dragging = ref(false)
const dragPointerId = ref<number | null>(null)

let dragStartY = 0
let dragCaptureElement: HTMLElement | null = null
let dragMoved = false
let suppressHandleClick = false
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

function restoreFocus() {
  if (previousActiveElement?.isConnected) previousActiveElement.focus()
  previousActiveElement = null
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
  dragMoved = false
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
  void nextTick(() => closeButtonRef.value?.focus())
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
  if (dialogRef.value?.open) dialogRef.value.close()
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
  restoreFocus()
  emit('close')
}

function handleDialogCancel(event: Event) {
  event.preventDefault()
  requestClose()
}

function handleDialogClick(event: MouseEvent) {
  if (event.target === event.currentTarget && props.closeOnBackdrop) requestClose()
}

function handleDragStart(event: PointerEvent) {
  if (!dialogRef.value?.open) return

  dragStartY = event.clientY
  dragPointerId.value = event.pointerId
  dragOffset.value = 0
  dragging.value = true
  dragMoved = false
  dragCaptureElement = event.currentTarget
  event.currentTarget.setPointerCapture(event.pointerId)
}

function handleDragMove(event: PointerEvent) {
  if (!dragging.value || dragPointerId.value !== event.pointerId) return

  dragOffset.value = Math.max(0, event.clientY - dragStartY)
  dragMoved ||= dragOffset.value > 0
}

function handleDragEnd(event: PointerEvent) {
  if (!dragging.value || dragPointerId.value !== event.pointerId) return

  const shouldClose = dragOffset.value >= CLOSE_THRESHOLD
  suppressHandleClick = dragMoved
  resetDragState()
  if (shouldClose) requestClose()
}

function handleDragHandleClick() {
  if (suppressHandleClick) {
    suppressHandleClick = false
    return
  }

  requestClose()
}

function handleUnmount() {
  if (dialogRef.value?.open) dialogRef.value.close()
  handleNativeClose()
}

watch(() => props.open, synchronizeDialog)

onMounted(() => synchronizeDialog(props.open))
onBeforeUnmount(handleUnmount)
onDeactivated(handleUnmount)
</script>

<template>
  <Teleport to="body">
    <dialog
      ref="dialogRef"
      class="fixed inset-0 m-0 flex h-full max-h-none w-full max-w-none items-end justify-center border-0 bg-transparent p-0 text-on-surface backdrop:bg-black/40"
      :aria-label="ariaLabel ?? 'Dialog'"
      @click="handleDialogClick"
      @cancel="handleDialogCancel"
      @close="handleNativeClose"
    >
      <Transition name="base-slide-overlay" appear @after-leave="finishCloseTransition">
        <div
          v-if="panelVisible"
          class="base-slide-overlay-panel relative z-10 flex max-h-[84vh] w-full flex-col overflow-hidden rounded-t-2xl bg-surface shadow-2xl"
          :class="{ 'is-dragging': dragging }"
          :style="dragging || dragOffset ? { transform: `translateY(${dragOffset}px)` } : undefined"
          @click.stop
        >
          <button
            type="button"
            class="flex w-full flex-none touch-none select-none items-center justify-center pb-1 pt-3"
            aria-label="Close dialog"
            @click="handleDragHandleClick"
            @pointerdown="handleDragStart"
            @pointermove="handleDragMove"
            @pointerup="handleDragEnd"
            @pointercancel="resetDragState"
          >
            <div class="h-1 w-9 rounded-full bg-outline-variant" aria-hidden="true" />
          </button>

          <button
            ref="closeButtonRef"
            type="button"
            class="absolute right-4 top-4 z-20 flex h-10 w-10 items-center justify-center rounded-full text-on-surface transition-colors hover:bg-surface-container focus:outline-none focus:ring-2 focus:ring-primary/40"
            aria-label="Close"
            @click="requestClose"
          >
            <span class="material-symbols-outlined text-[20px]" aria-hidden="true">close</span>
          </button>

          <div class="min-h-0 flex-1 overflow-y-auto no-scrollbar">
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

.base-slide-overlay-panel {
  will-change: transform, opacity;
  transition: transform 200ms cubic-bezier(0.2, 0.8, 0.2, 1);
}

.base-slide-overlay-panel.is-dragging {
  transition: none;
}

.base-slide-overlay-enter-active,
.base-slide-overlay-leave-active {
  transition: opacity 220ms ease, transform 220ms cubic-bezier(0.2, 0.8, 0.2, 1);
}

.base-slide-overlay-enter-from,
.base-slide-overlay-leave-to {
  opacity: 0;
  transform: translateY(100%);
}
</style>
