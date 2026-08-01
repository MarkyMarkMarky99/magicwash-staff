<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, watch } from 'vue'

const props = defineProps<{
  open: boolean
  url: string | null
}>()

const emit = defineEmits<{
  close: []
}>()

const closeRef = ref<HTMLButtonElement | null>(null)
let previousActiveElement: Element | null = null

function onKeyDown(event: KeyboardEvent) {
  if (event.key !== 'Escape') return
  event.stopPropagation()
  emit('close')
}

function restoreFocus() {
  if (previousActiveElement instanceof HTMLElement) previousActiveElement.focus()
  previousActiveElement = null
}

watch(() => props.open, async (isOpen) => {
  if (isOpen) {
    previousActiveElement = document.activeElement
    document.addEventListener('keydown', onKeyDown, true)
    await nextTick()
    closeRef.value?.focus()
  } else {
    document.removeEventListener('keydown', onKeyDown, true)
    restoreFocus()
  }
})

onBeforeUnmount(() => {
  document.removeEventListener('keydown', onKeyDown, true)
  restoreFocus()
})
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open && url"
      class="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 p-6 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="View payment proof"
      @click="emit('close')"
    >
      <button
        ref="closeRef"
        type="button"
        class="absolute right-4 top-4 text-white/80 transition-all hover:text-white active:scale-95 focus:outline-none"
        aria-label="Close"
        @click="emit('close')"
      >
        <span class="material-symbols-outlined text-[28px]" aria-hidden="true">close</span>
      </button>
      <div class="flex max-h-full max-w-full items-center justify-center" @click.stop>
        <img
          :src="url"
          alt="Payment proof"
          referrerpolicy="no-referrer"
          class="max-h-[80vh] max-w-full rounded-xl object-contain shadow-2xl"
        />
      </div>
    </div>
  </Teleport>
</template>
