<script setup lang="ts">
import { nextTick, onBeforeUnmount, onDeactivated, onMounted, ref, watch } from 'vue'
import { acquirePageScrollLock, releasePageScrollLock } from '@/shared/layouts/use-page-scroll-lock'

const props = withDefaults(
  defineProps<{
    open: boolean
    closeOnBackdrop?: boolean
    ariaLabel?: string
    dialogClass?: string
    panelClass?: string
    closeButtonClass?: string
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
  restorePageScroll()
  resetFocus()
  emit('close')
}

function handleDialogCancel(event: Event) {
  event.preventDefault()
  requestClose()
}

function handleDialogClick(event: MouseEvent) {
  if (event.target === event.currentTarget && props.closeOnBackdrop) requestClose()
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
      :class="['fixed inset-0 m-0 flex h-full max-h-none w-full max-w-none items-end justify-center border-0 bg-transparent p-0 text-on-surface backdrop:bg-black/40', dialogClass]"
      :aria-label="ariaLabel ?? 'Dialog'"
      @click="handleDialogClick"
      @cancel="handleDialogCancel"
      @close="handleNativeClose"
    >
      <Transition name="base-full-overlay" appear @after-leave="finishCloseTransition">
        <div
          v-if="panelVisible"
          :class="['base-full-overlay-panel relative z-10 flex h-full w-full flex-col overflow-hidden bg-surface', panelClass]"
          @click.stop
        >
          <button
            ref="closeButtonRef"
            type="button"
            :class="['absolute right-4 top-4 z-20 flex h-10 w-10 items-center justify-center rounded-full text-on-surface transition-colors hover:bg-surface-container focus:outline-none focus:ring-2 focus:ring-primary/40', closeButtonClass]"
            aria-label="Close"
            @click="requestClose"
          >
            <slot name="close-button">
              <span class="material-symbols-outlined text-[20px]" aria-hidden="true">close</span>
            </slot>
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

.base-full-overlay-panel {
  will-change: transform, opacity;
}

.base-full-overlay-enter-active,
.base-full-overlay-leave-active {
  transition: opacity 180ms ease, transform 180ms ease;
}

.base-full-overlay-enter-from,
.base-full-overlay-leave-to {
  opacity: 0;
  transform: scale(0.98);
}
</style>
